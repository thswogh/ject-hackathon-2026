/**
 * 하이브리드 판독 (JUDGE_SOURCE=hybrid, 기본값).
 * 사실(선수·연도·기록)은 준비된 기록(lib/fallback.ts)에서 고르고,
 * AI는 웹 검색 없이 그 사실로 위로·동기부여·독설 문구와 처방만 다시 쓴다.
 * AI가 실패하거나 늦으면 템플릿 문구를 그대로 쓴다. 서버 전용.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildFallback, type ExtraPeaks } from "./fallback";
import type { JudgeResult } from "./schema";
import type { SportChoice } from "./sports";

const TIMEOUT_MS = 9_000;
const BANNED = ["씨발", "시발", "병신", "좆", "개새", "꺼져", "죽어", "뚱뚱", "못생", "늙은이", "틀딱"];

const CopySchema = z.object({
  comfortLine: z.string(),
  motivateLine: z.string(),
  roastLines: z.array(z.string()),
  prescription: z.string(),
});

const COPY_PROMPT = `당신은 웹 서비스 "GAP"(선수와 나 사이의 차이를 보여주고 오늘 운동하게 만드는 서비스)의 카피라이터입니다. 사용자는 자기 나이를 넣고, 같은 나이에 스포츠 선수가 해낸 일을 보고 충격을 받았습니다. 이제 위로, 동기부여, 신랄한 비판 중 하나를 고르고 오늘 10분짜리 운동 처방을 받습니다. 쓸데없는 비교로 시작해서 오늘 밖으로 나가게 만드는 것이 목표입니다.

입력으로 검증된 사실(JSON)이 주어집니다. 그 사실만 써서 문구를 만듭니다.

# 사실 규칙 — 가장 중요
- 입력에 없는 사실, 숫자, 연도, 팀 이름, 선수 이름을 새로 만들지 않습니다.
- 선수의 말을 따옴표로 인용하지 않습니다.

# 쓸 것
- comfortLine: comfort 사실로 쓴 위로 한두 문장, 70자 이내. 힘들던 나이와 뒤늦은 성공을 대비시킵니다.
- motivateLine: motivate 습관을 바탕으로 "오늘 딱 하나만" 느낌의 한두 문장, 70자 이내.
- roastLines: 서로 다른 독설 정확히 3개, 각 50자 이내. 과녁은 "지금 이 앱을 보고 있는 행동"입니다. reveal 선수를 끌어와도 좋습니다.
- prescription: workout 처방을 더 재치 있게 다시 쓴 한 문장, 40자 이내. 운동 종류와 양은 바꾸지 않습니다.

# 톤
- 한국어 존댓말, 짧은 문장, 이모지와 해시태그 금지.
- 웃기되 잔인하지 않게. 사용자의 나이 자체, 외모, 체형, 성별, 질병, 장애, 지역, 학력, 직업을 건드리지 않습니다. 욕설과 선수 비하 금지.`;

let client: OpenAI | null = null;

export async function judgeHybrid(input: {
  sport: SportChoice;
  age: number;
  exclude: string[];
  visit?: number;
  extra?: ExtraPeaks;
}): Promise<{
  result: JudgeResult;
  log: string[];
}> {
  const visit = input.visit ?? 0;
  const base = buildFallback(input.sport, input.age, input.exclude, visit, input.extra);
  const log: string[] = [];
  if (!process.env.OPENAI_API_KEY) return { result: base, log: ["키 없음: 템플릿 문구"] };

  const started = Date.now();
  try {
    client ??= new OpenAI();
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const facts = {
      userAge: input.age,
      reveal: { athlete: base.reveal.athlete, age: base.reveal.eventAge, year: base.reveal.eventYear, fact: base.reveal.headline },
      comfort: {
        athlete: base.comfort.athlete,
        lowAge: base.comfort.lowAge,
        lowText: base.comfort.lowText,
        laterAge: base.comfort.laterAge,
        laterText: base.comfort.laterText,
      },
      motivate: { athlete: base.motivate.athlete, habit: base.motivate.habit },
      workout: base.workout,
    };
    const res = await client.responses.parse(
      {
        model,
        // 추론 모델은 temperature를 받지 않는다. 일반 모델은 재방문할수록 문구 온도를 올린다 (0.8 → 최대 1.0, 더 올리면 반말·영어가 섞인다)
        ...(/^(gpt-5|o\d)/.test(model)
          ? { reasoning: { effort: "low" as const } }
          : { temperature: Math.min(1.0, 0.8 + 0.05 * visit) }),
        max_output_tokens: /^(gpt-5|o\d)/.test(model) ? 4000 : 700,
        instructions: COPY_PROMPT,
        input: JSON.stringify(facts),
        text: { format: zodTextFormat(CopySchema, "copy") },
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS), maxRetries: 0 },
    );
    const c = res.output_parsed;
    if (!c) throw new Error("빈 응답");
    const all = [c.comfortLine, c.motivateLine, c.prescription, ...c.roastLines];
    const ok =
      c.roastLines.length === 3 &&
      c.comfortLine.length <= 110 &&
      c.motivateLine.length <= 110 &&
      c.prescription.length <= 60 &&
      c.roastLines.every((l) => l.length > 0 && l.length <= 70) &&
      !all.some((t) => BANNED.some((w) => t.includes(w))) &&
      !all.some((t) => /[぀-ヿ一-鿿]/.test(t)); // 일본어·한자 섞이면 버린다
    if (!ok) throw new Error("문구 검증 실패");
    log.push(`AI 문구 (${Date.now() - started}ms)`);
    return {
      result: {
        ...base,
        comfort: { ...base.comfort, line: c.comfortLine },
        motivate: { ...base.motivate, line: c.motivateLine },
        roast: { lines: c.roastLines },
        workout: { ...base.workout, prescription: c.prescription },
      },
      log,
    };
  } catch (e) {
    log.push(`템플릿 문구 사용 (${Date.now() - started}ms): ${String((e as Error).message).slice(0, 120)}`);
    return { result: base, log };
  }
}
