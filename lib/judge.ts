/**
 * AI 판독 (서버 전용, docs/spec.md 7절). 클라이언트 컴포넌트에서 import하지 않는다.
 * 실패, 타임아웃, 검증 실패는 모두 비상용 결과로 끝난다. 이 함수는 throw하지 않는다.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Response } from "openai/resources/responses/responses";
import { buildFallback, type ExtraPeaks } from "./fallback";
import { judgeHybrid } from "./hybrid";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { ModelOutputSchema, type JudgeResult, type ModelOutput, type Source } from "./schema";
import { currentYear, type SportChoice } from "./sports";
import { validateOutput } from "./validate";

/**
 * gpt-5-mini + 웹 검색은 실측 25~30초. 정확도를 위해 37초까지 기다리고,
 * 클라이언트는 40초에서 비상용 결과로 넘어간다 (lib/copy.ts VAR_LINES와 맞출 것).
 */
export const TOTAL_BUDGET_MS = 37_000;
const RETRY_IF_UNDER_MS = 10_000; // 첫 시도가 빨리 끝났을 때만 재시도 (실패 시 최대 대기 약 22초)

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI(); // OPENAI_API_KEY
  return client;
}

const PREFERRED_HOSTS = ["wikipedia.org", "namu.wiki", "kbo.or.kr", "mlb.com", "nba.com", "premierleague.com", "lolesports.com"];

/** 출처는 모델이 쓴 URL이 아니라, 실제 웹 검색 인용과 검색 결과에서 뽑는다. */
export function extractSources(res: Response, limit = 3): Source[] {
  const found = new Map<string, Source>();
  for (const item of res.output) {
    if (item.type === "message") {
      for (const c of item.content) {
        if (c.type !== "output_text") continue;
        for (const a of c.annotations ?? []) {
          if (a.type === "url_citation") found.set(a.url, { title: a.title || hostOf(a.url), url: a.url });
        }
      }
    }
    if (item.type === "web_search_call" && item.action?.type === "search") {
      for (const s of item.action.sources ?? []) {
        if (!found.has(s.url)) found.set(s.url, { title: hostOf(s.url), url: s.url });
      }
    }
  }
  const list = [...found.values()].filter((s) => s.url.startsWith("https://"));
  const score = (s: Source) => (PREFERRED_HOSTS.some((h) => hostOf(s.url).endsWith(h)) ? 0 : 1);
  return list.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function callModel(
  input: { sport: SportChoice; age: number; exclude: string[] },
  timeoutMs: number,
): Promise<{ out: ModelOutput; sources: Source[] }> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const isReasoning = /^(gpt-5|o\d)/.test(model);
  const res = await getClient().responses.parse(
    {
      model,
      ...(isReasoning ? { reasoning: { effort: "low" as const } } : {}),
      // 정상 응답은 약 600토큰. gpt-4o-mini가 가끔 제어 문자를 반복하며 멈추지 않을 때 빨리 끊고 재시도한다
      max_output_tokens: isReasoning ? 8000 : 1500,
      instructions: SYSTEM_PROMPT,
      input: buildUserMessage({ ...input, year: currentYear() }),
      tools: [{ type: "web_search" }],
      tool_choice: "required", // 검색 없이 기억으로만 쓰지 못하게 한다
      include: ["web_search_call.action.sources"],
      text: { format: zodTextFormat(ModelOutputSchema, "judge_result") },
    },
    { signal: AbortSignal.timeout(timeoutMs), maxRetries: 0 },
  );
  const out = res.output_parsed;
  if (!out) throw new Error("파싱 결과 없음 (거절 또는 빈 응답)");
  return { out, sources: extractSources(res) };
}

export async function judge(input: {
  sport: SportChoice;
  age: number;
  exclude: string[];
  visit?: number;
  /** 실시간 발굴로 확인된 기록 (하이브리드·비상용 결과에서 준비된 기록과 함께 고른다) */
  extra?: ExtraPeaks;
}): Promise<{
  result: JudgeResult;
  log: string[];
}> {
  const started = Date.now();
  const log: string[] = [];
  const sourceMode = process.env.JUDGE_SOURCE || "hybrid";
  if (sourceMode === "hybrid") return judgeHybrid(input);
  if (sourceMode === "curated") {
    log.push("JUDGE_SOURCE=curated: 준비된 기록 사용");
    return { result: buildFallback(input.sport, input.age, input.exclude, input.visit, input.extra), log };
  }
  if (!process.env.OPENAI_API_KEY) {
    log.push("OPENAI_API_KEY 없음");
    return { result: buildFallback(input.sport, input.age, input.exclude, input.visit, input.extra), log };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const elapsed = Date.now() - started;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (attempt === 2 && elapsed >= RETRY_IF_UNDER_MS) break;
    try {
      const { out, sources } = await callModel(input, remaining);
      if (input.sport !== "any") out.reveal.sport = input.sport;
      const issues = validateOutput(out, { age: input.age, exclude: input.exclude, allowMedium: attempt === 2 });
      if (issues.length === 0) {
        log.push(`성공 (시도 ${attempt}, ${Date.now() - started}ms, 출처 ${sources.length}개)`);
        return { result: { ...out, sources, source: "ai" }, log };
      }
      log.push(`검증 실패 (시도 ${attempt}): ${issues.join(", ")}`);
    } catch (e) {
      const err = e as { status?: number; name?: string; message?: string };
      log.push(`호출 실패 (시도 ${attempt}): ${err.status ?? err.name ?? ""} ${String(err.message).slice(0, 160)}`);
      if (err.name === "AbortError" || err.name === "TimeoutError" || err.status === 429 || err.status === 401) break;
    }
  }
  log.push(`비상용 결과 사용 (${Date.now() - started}ms)`);
  return { result: buildFallback(input.sport, input.age, input.exclude, input.visit, input.extra), log };
}
