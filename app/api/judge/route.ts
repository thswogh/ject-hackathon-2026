import { after } from "next/server";
import { maybeDiscover } from "@/lib/discover";
import { buildFallback } from "@/lib/fallback";
import { judge } from "@/lib/judge";
import { allowAiCall, readSession, sessionCookie } from "@/lib/ratelimit";
import { JudgeRequestSchema, type JudgeResult } from "@/lib/schema";
import { SPORT_IDS, clampAge, isSportChoice } from "@/lib/sports";
import { getConfirmed } from "@/lib/store";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const parsed = JudgeRequestSchema.safeParse(body);
  if (!parsed.success || !isSportChoice(parsed.data.sport)) {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const sport = parsed.data.sport;
  const age = clampAge(parsed.data.age);
  const exclude = parsed.data.excludeAthletes.map((s) => s.trim()).filter(Boolean);
  const visit = Math.min(100, Math.max(0, Math.floor(parsed.data.visit) || 0));
  const session = readSession(request);

  const json = (body: unknown) => {
    const headers = new Headers();
    if (session.fresh) headers.set("Set-Cookie", sessionCookie(session.id, request));
    return Response.json(body, { headers });
  };

  // 실시간 발굴로 확인된 기록 (docs/spec.md 7.9). 저장소가 실패하면 빈 값이라 판독은 그대로 진행된다.
  const extra = await getConfirmed(sport === "any" ? SPORT_IDS : [sport]);

  if (!allowAiCall(session.id)) {
    console.log(`[judge] 호출 제한 ${sport} ${age}세 → fallback`);
    return json(buildFallback(sport, age, exclude, visit, extra));
  }

  let result: JudgeResult;
  try {
    const judged = await judge({ sport, age, exclude, visit, extra });
    result = judged.result;
    console.log(`[judge] ${sport} ${age}세 방문${visit} → ${result.source} | ${judged.log.join(" | ")}`);
  } catch (e) {
    console.error("[judge] 예외", e);
    result = buildFallback(sport, age, exclude, visit, extra);
  }

  // 응답을 보낸 뒤 그 종목·나이의 새 기록을 찾는다. 사용자는 기다리지 않는다.
  if ((process.env.JUDGE_SOURCE || "hybrid") === "hybrid") {
    const target = { sport: result.reveal.sport, age };
    after(async () => console.log(`[discover] ${target.sport} ${age}세 → ${await maybeDiscover(target)}`));
  }
  return json(result);
}
