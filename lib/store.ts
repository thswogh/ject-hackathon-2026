/**
 * 실시간 발굴 기록 저장소 (서버 전용, docs/spec.md 7.9).
 * Vercel에 연결한 Upstash Redis를 쓴다. 환경 변수가 없으면(로컬) 프로세스 메모리에 둔다.
 * 메모리 저장은 서버를 다시 켜거나 인스턴스가 바뀌면 사라진다.
 */
import { Redis } from "@upstash/redis";
import type { Peak } from "./fallback";
import { shortName } from "./josa";
import type { Source } from "./schema";
import { SPORT_IDS, type SportId } from "./sports";

/** 서로 다른 발굴 호출에서 이만큼 같은 기록이 나와야 화면에 쓴다. */
export const CONFIRMATIONS = 2;
const PREFIX = "gap:v1";
const CACHE_MS = 60_000;

export type Discovered = Omit<Peak, "verified"> & {
  sources: Source[];
  seen: number;
  firstSeen: string;
};

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const storeKind = redis ? "redis" : "memory";

const mem = {
  peaks: new Map<string, Map<string, Discovered>>(),
  kv: new Map<string, { value: number; expires: number }>(),
};

const peaksKey = (sport: SportId) => `${PREFIX}:peaks:${sport}`;
/** 같은 선수·같은 해 기록은 하나로 본다 (요약 문구는 호출마다 달라서 키에 넣지 않는다). */
export const peakField = (p: { athlete: string; eventYear: number }) => `${shortName(p.athlete).replace(/\s+/g, "")}|${p.eventYear}`;

async function readAll(sport: SportId): Promise<Discovered[]> {
  if (!redis) return [...(mem.peaks.get(sport)?.values() ?? [])];
  const all = await redis.hgetall<Record<string, Discovered>>(peaksKey(sport));
  return Object.values(all ?? {});
}

async function writeOne(sport: SportId, field: string, value: Discovered): Promise<void> {
  if (!redis) {
    if (!mem.peaks.has(sport)) mem.peaks.set(sport, new Map());
    mem.peaks.get(sport)!.set(field, value);
    return;
  }
  await redis.hset(peaksKey(sport), { [field]: value });
}

const cache = new Map<SportId, { at: number; list: Discovered[] }>();

/** 확인 횟수를 채운 기록만. 저장소가 실패해도 빈 배열을 돌려준다(판독은 멈추지 않는다). */
export async function getConfirmed(sports: readonly SportId[] = SPORT_IDS): Promise<Partial<Record<SportId, Peak[]>>> {
  const out: Partial<Record<SportId, Peak[]>> = {};
  await Promise.all(
    sports.map(async (s) => {
      try {
        const hit = cache.get(s);
        const list = hit && Date.now() - hit.at < CACHE_MS ? hit.list : await readAll(s);
        cache.set(s, { at: Date.now(), list });
        out[s] = list.filter((d) => d.seen >= CONFIRMATIONS).map((d) => ({ ...d, verified: false }));
      } catch (e) {
        console.error("[store] 읽기 실패", s, String(e).slice(0, 120));
        out[s] = [];
      }
    }),
  );
  return out;
}

/** 전체 기록(미확인 포함) 개수와 나이 분포를 볼 때 쓴다. */
export async function getAll(sport: SportId): Promise<Discovered[]> {
  return readAll(sport);
}

/** 후보를 기록한다. 같은 기록이 이미 있으면 seen을 올리고 출처를 합친다. */
export async function recordCandidates(sport: SportId, peaks: Omit<Discovered, "seen" | "firstSeen">[]): Promise<number> {
  const existing = new Map((await readAll(sport)).map((d) => [peakField(d), d]));
  let confirmed = 0;
  for (const p of peaks) {
    const field = peakField(p);
    const prev = existing.get(field);
    // 같은 선수·연도가 다른 나이나 출생 연도로 오면 둘 중 하나가 틀렸다. 새로 쌓지 않는다.
    if (prev && (prev.birthYear !== p.birthYear || prev.eventAge !== p.eventAge)) continue;
    const sources = [...(prev?.sources ?? []), ...p.sources].filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i).slice(0, 3);
    const next: Discovered = { ...(prev ?? p), sources, seen: (prev?.seen ?? 0) + 1, firstSeen: prev?.firstSeen ?? new Date().toISOString() };
    await writeOne(sport, field, next);
    if (next.seen === CONFIRMATIONS) confirmed++;
  }
  cache.delete(sport);
  return confirmed;
}

/** 같은 종목·나이로 동시에 발굴하지 않게 잠근다. 잡으면 true. */
export async function tryLock(key: string, seconds: number): Promise<boolean> {
  const k = `${PREFIX}:lock:${key}`;
  if (!redis) {
    const hit = mem.kv.get(k);
    if (hit && hit.expires > Date.now()) return false;
    mem.kv.set(k, { value: 1, expires: Date.now() + seconds * 1000 });
    return true;
  }
  return (await redis.set(k, 1, { nx: true, ex: seconds })) === "OK";
}

/** 오늘(UTC) 발굴 호출 수를 1 올리고 올린 값을 돌려준다. */
export async function incrDaily(): Promise<number> {
  const k = `${PREFIX}:discover:${new Date().toISOString().slice(0, 10)}`;
  if (!redis) {
    const hit = mem.kv.get(k);
    const value = (hit && hit.expires > Date.now() ? hit.value : 0) + 1;
    mem.kv.set(k, { value, expires: Date.now() + 2 * 86_400_000 });
    return value;
  }
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 2 * 86_400);
  return n;
}
