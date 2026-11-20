/**
 * 비상용 결과 (docs/fallback.md). AI 판독이 실패했을 때만 쓴다.
 * verified: false 항목은 팀 검증 전이다. 검증하면 true로 바꾸고, 틀리면 지운다.
 */
import { buildHeadline } from "./headline";
import { josa, shortName } from "./josa";
import { ROAST_POOL } from "./copy";
import type { JudgeResult, Source } from "./schema";
import { SPORT_IDS, type SportChoice, type SportId } from "./sports";

export type Peak = {
  athlete: string;
  birthYear: number;
  eventYear: number;
  eventAge: number;
  fact: string;
  shortFact: string;
  /** 1: 종목을 잘 몰라도 아는 슈퍼스타 (첫 판독에 우선) / 2: 팬이라면 아는 스타 (재방문할수록 섞임) */
  fame: 1 | 2;
  verified: boolean;
  /** 실시간 발굴(lib/discover.ts)로 들어온 기록만 출처가 있다 */
  sources?: Source[];
};

/** 실시간 발굴로 확인된 기록 (lib/store.ts getConfirmed). 종목별로 준비된 기록 뒤에 섞는다. */
export type ExtraPeaks = Partial<Record<SportId, Peak[]>>;

type Comfort = { athlete: string; lowAge: number; lowText: string; laterAge: number; laterText: string };

const P = (
  athlete: string,
  birthYear: number,
  eventYear: number,
  eventAge: number,
  fact: string,
  shortFact: string,
  fame: 1 | 2 = 1,
): Peak => ({ athlete, birthYear, eventYear, eventAge, fact, shortFact, fame, verified: false });

export const PEAKS: Record<SportId, Peak[]> = {
  baseball_kr: [
    P("류현진", 1987, 2006, 19, "데뷔 첫해에 KBO 신인왕과 정규시즌 MVP를 동시에 받았습니다", "신인왕+MVP"),
    P("김광현", 1988, 2008, 20, "KBO 정규시즌 MVP를 받았습니다", "정규시즌 MVP", 2),
    P("이승엽", 1976, 1997, 21, "홈런왕과 정규시즌 MVP를 차지했습니다", "홈런왕+MVP"),
    P("김도영", 2003, 2024, 21, "38홈런 40도루로 정규시즌 MVP를 받았습니다", "정규시즌 MVP"),
    P("선동열", 1963, 1986, 23, "평균자책점 0.99를 기록했습니다", "평균자책점 0.99"),
    P("이정후", 1998, 2022, 24, "KBO 정규시즌 MVP를 받았습니다", "정규시즌 MVP"),
    P("이종범", 1970, 1994, 24, "한 시즌 도루 84개를 기록하며 정규시즌 MVP를 받았습니다", "정규시즌 MVP", 2),
    P("오승환", 1982, 2006, 24, "한 시즌 47세이브를 올렸습니다", "시즌 47세이브", 2),
    P("이승엽", 1976, 2003, 27, "한 시즌 56홈런을 쳐 아시아 단일 시즌 최다 홈런 기록을 세웠습니다", "시즌 56홈런"),
    P("이대호", 1982, 2010, 28, "타격 7관왕을 차지했습니다", "타격 7관왕"),
    P("박병호", 1986, 2014, 28, "한 시즌 52홈런을 쳤습니다", "시즌 52홈런", 2),
    P("양현종", 1988, 2017, 29, "정규시즌 MVP와 한국시리즈 MVP를 한 해에 모두 받았습니다", "MVP 2관왕", 2),
    P("최정", 1987, 2024, 37, "KBO 통산 최다 홈런 기록을 새로 썼습니다", "통산 최다 홈런", 2),
  ],
  baseball_world: [
    P("박찬호", 1973, 1994, 20, "한국인 최초로 메이저리그 마운드에 올랐습니다", "한국인 첫 MLB"),
    P("데릭 지터", 1974, 1996, 22, "신인왕과 월드시리즈 우승을 함께 차지했습니다", "신인왕+우승", 2),
    P("마이크 트라웃", 1991, 2014, 23, "아메리칸리그 MVP를 만장일치로 받았습니다", "만장일치 MVP", 2),
    P("오타니 쇼헤이", 1994, 2018, 24, "아메리칸리그 신인왕을 받았습니다", "AL 신인왕"),
    P("이정후", 1998, 2023, 25, "샌프란시스코와 6년 1억 1300만 달러 계약을 맺었습니다", "SF 대형 계약"),
    P("오타니 쇼헤이", 1994, 2021, 27, "투타 겸업으로 아메리칸리그 MVP를 만장일치로 받았습니다", "만장일치 MVP"),
    P("박찬호", 1973, 2001, 28, "메이저리그 올스타에 뽑혔습니다", "MLB 올스타"),
    P("스즈키 이치로", 1973, 2001, 28, "메이저리그 데뷔 첫해에 신인왕과 MVP를 동시에 받았습니다", "신인왕+MVP"),
    P("김하성", 1995, 2023, 28, "한국인 최초로 메이저리그 골드글러브를 받았습니다", "골드글러브", 2),
    P("오타니 쇼헤이", 1994, 2023, 29, "두 번째 만장일치 MVP를 받았습니다", "2번째 만장일치 MVP"),
    P("오타니 쇼헤이", 1994, 2024, 30, "메이저리그 최초로 한 시즌 50홈런 50도루를 달성했습니다", "50홈런 50도루"),
    P("스즈키 이치로", 1973, 2004, 30, "한 시즌 262안타로 메이저리그 최다 안타 기록을 세웠습니다", "시즌 262안타"),
    P("추신수", 1982, 2013, 31, "텍사스와 7년 1억 3천만 달러 FA 계약을 맺었습니다", "대형 FA 계약"),
    P("류현진", 1987, 2019, 32, "내셔널리그 평균자책점 1위에 올랐습니다", "NL 평균자책점 1위"),
  ],
  soccer_kr: [
    P("이강인", 2001, 2019, 18, "U-20 월드컵 골든볼을 받았습니다", "U-20 골든볼"),
    P("이동국", 1979, 1998, 19, "국가대표로 월드컵 본선 무대를 밟았습니다", "월드컵 출전", 2),
    P("박지성", 1981, 2002, 21, "월드컵 포르투갈전에서 결승골을 넣었습니다", "포르투갈전 결승골"),
    P("조규성", 1998, 2022, 24, "월드컵 가나전에서 혼자 두 골을 넣었습니다", "월드컵 멀티골", 2),
    P("차범근", 1953, 1980, 26, "프랑크푸르트 소속으로 UEFA컵 우승을 차지했습니다", "UEFA컵 우승"),
    P("안정환", 1976, 2002, 26, "월드컵 이탈리아전에서 골든골을 넣었습니다", "이탈리아전 골든골"),
    P("손흥민", 1992, 2018, 26, "아시안게임 금메달을 땄습니다", "아시안게임 금메달"),
    P("황희찬", 1996, 2022, 26, "월드컵 포르투갈전에서 16강 진출을 확정하는 결승골을 넣었습니다", "포르투갈전 결승골", 2),
    P("이동국", 1979, 2009, 30, "K리그 MVP와 득점왕을 함께 차지했습니다", "K리그 MVP", 2),
    P("손흥민", 1992, 2022, 30, "국가대표 주장으로 월드컵 16강을 이끌었습니다", "주장, 월드컵 16강"),
    P("홍명보", 1969, 2002, 33, "주장으로 월드컵 4강을 이끌었습니다", "주장, 월드컵 4강"),
    P("이동국", 1979, 2017, 38, "K리그 최초로 통산 200골을 넣었습니다", "K리그 200골", 2),
  ],
  soccer_world: [
    P("펠레", 1940, 1958, 17, "월드컵 결승에서 두 골을 넣으며 우승했습니다", "월드컵 우승"),
    P("라민 야말", 2007, 2024, 17, "스페인의 유로 우승을 이끌었습니다", "유로 우승", 2),
    P("킬리안 음바페", 1998, 2018, 19, "월드컵에서 우승했습니다", "월드컵 우승"),
    P("리오넬 메시", 1987, 2009, 22, "첫 발롱도르를 받았습니다", "첫 발롱도르"),
    P("엘링 홀란", 2000, 2023, 22, "프리미어리그 한 시즌 최다인 36골을 넣었습니다", "EPL 시즌 36골"),
    P("크리스티아누 호날두", 1985, 2008, 23, "첫 발롱도르를 받았습니다", "첫 발롱도르"),
    P("디에고 마라도나", 1960, 1986, 25, "아르헨티나의 월드컵 우승을 이끌었습니다", "월드컵 우승"),
    P("리오넬 메시", 1987, 2012, 25, "한 해에 91골을 넣어 최다 골 기록을 세웠습니다", "한 해 91골"),
    P("지네딘 지단", 1972, 1998, 26, "월드컵 결승에서 두 골을 넣으며 우승했습니다", "월드컵 우승"),
    P("손흥민", 1992, 2019, 26, "챔피언스리그 결승에 선발로 나섰습니다", "챔스 결승 선발"),
    P("김민재", 1996, 2023, 26, "나폴리의 33년 만의 세리에A 우승을 이끌었습니다", "세리에A 우승", 2),
    P("손흥민", 1992, 2022, 29, "프리미어리그 득점왕에 올랐습니다", "EPL 득점왕"),
    P("크리스티아누 호날두", 1985, 2016, 31, "포르투갈의 유로 우승을 이끌었습니다", "유로 우승"),
    P("리오넬 메시", 1987, 2022, 35, "월드컵에서 우승했습니다", "월드컵 우승"),
  ],
  nba: [
    P("코비 브라이언트", 1978, 1996, 17, "고등학교 졸업과 동시에 NBA 드래프트에 뽑혔습니다", "고졸 드래프트"),
    P("르브론 제임스", 1984, 2003, 18, "NBA 드래프트 전체 1순위로 뽑혔습니다", "전체 1순위"),
    P("빅토르 웸반야마", 2004, 2023, 19, "NBA 드래프트 전체 1순위로 뽑혔습니다", "전체 1순위", 2),
    P("매직 존슨", 1959, 1980, 20, "신인으로 NBA 우승과 파이널 MVP를 차지했습니다", "신인 파이널 MVP", 2),
    P("코비 브라이언트", 1978, 2000, 21, "첫 NBA 우승을 차지했습니다", "첫 우승"),
    P("르브론 제임스", 1984, 2009, 24, "첫 정규시즌 MVP를 받았습니다", "첫 MVP"),
    P("마이클 조던", 1963, 1988, 25, "첫 정규시즌 MVP를 받았습니다", "첫 MVP"),
    P("케빈 듀란트", 1988, 2014, 25, "정규시즌 MVP를 받았습니다", "정규시즌 MVP"),
    P("야니스 아데토쿤보", 1994, 2021, 26, "첫 NBA 우승과 파이널 MVP를 차지했습니다", "첫 우승", 2),
    P("코비 브라이언트", 1978, 2006, 27, "한 경기에 81점을 넣었습니다", "한 경기 81점"),
    P("르브론 제임스", 1984, 2012, 27, "첫 NBA 우승과 파이널 MVP를 차지했습니다", "첫 우승"),
    P("스테픈 커리", 1988, 2015, 27, "첫 NBA 우승을 차지했습니다", "첫 우승"),
    P("스테픈 커리", 1988, 2016, 28, "NBA 역사상 첫 만장일치 MVP를 받았습니다", "만장일치 MVP"),
    P("마이클 조던", 1963, 1991, 28, "첫 NBA 우승과 파이널 MVP를 차지했습니다", "첫 우승"),
    P("더크 노비츠키", 1978, 2011, 32, "첫 NBA 우승과 파이널 MVP를 차지했습니다", "첫 우승", 2),
    P("르브론 제임스", 1984, 2020, 35, "네 번째 NBA 우승을 차지했습니다", "4번째 우승"),
  ],
  esports: [
    P("페이커 (이상혁)", 1996, 2013, 17, "롤드컵에서 첫 우승을 차지했습니다", "첫 롤드컵 우승"),
    P("룰러 (박재혁)", 1998, 2017, 18, "롤드컵에서 우승했습니다", "롤드컵 우승"),
    P("페이커 (이상혁)", 1996, 2015, 19, "두 번째 롤드컵 우승을 차지했습니다", "롤드컵 2회"),
    P("제우스 (최우제)", 2004, 2023, 19, "롤드컵에서 우승했습니다", "롤드컵 우승", 2),
    P("페이커 (이상혁)", 1996, 2016, 20, "세 번째 롤드컵 우승을 차지했습니다", "롤드컵 3회"),
    P("쇼메이커 (허수)", 2000, 2020, 20, "롤드컵에서 우승했습니다", "롤드컵 우승", 2),
    P("케리아 (류민석)", 2002, 2023, 21, "롤드컵에서 우승했습니다", "롤드컵 우승", 2),
    P("데프트 (김혁규)", 1996, 2022, 26, "데뷔 9년 만에 첫 롤드컵 우승을 차지했습니다", "첫 롤드컵 우승"),
    P("페이커 (이상혁)", 1996, 2023, 27, "네 번째 롤드컵 우승을 차지했습니다", "롤드컵 4회"),
    P("페이커 (이상혁)", 1996, 2024, 28, "다섯 번째 롤드컵 우승을 차지했습니다", "롤드컵 5회"),
  ],
};

const COMFORTS: Record<SportId, Comfort[]> = {
  baseball_kr: [{ athlete: "박병호", lowAge: 25, lowText: "1군에 자리를 잡지 못하고 트레이드됐습니다", laterAge: 26, laterText: "정규시즌 MVP를 받았습니다" }],
  baseball_world: [{ athlete: "추신수", lowAge: 24, lowText: "마이너리그를 오가며 자리를 잡지 못했습니다", laterAge: 31, laterText: "7년 대형 FA 계약을 맺었습니다" }],
  soccer_kr: [{ athlete: "이동국", lowAge: 23, lowText: "월드컵 최종 명단에서 빠졌습니다", laterAge: 30, laterText: "K리그 MVP와 득점왕을 차지했습니다" }],
  soccer_world: [{ athlete: "제이미 바디", lowAge: 25, lowText: "5부 리그 팀에서 뛰다 겨우 2부 리그 팀으로 옮겼습니다", laterAge: 29, laterText: "프리미어리그 우승을 차지했습니다" }],
  nba: [
    { athlete: "마이클 조던", lowAge: 15, lowText: "고등학교 대표팀 선발에서 떨어졌습니다", laterAge: 28, laterText: "첫 NBA 우승을 차지했습니다" },
    { athlete: "더크 노비츠키", lowAge: 28, lowText: "MVP를 받은 해에 플레이오프 1라운드에서 탈락했습니다", laterAge: 32, laterText: "첫 NBA 우승을 차지했습니다" },
  ],
  esports: [{ athlete: "데프트", lowAge: 25, lowText: "프로 8년이 넘도록 롤드컵 우승이 없었습니다", laterAge: 26, laterText: "첫 롤드컵 우승을 차지했습니다" }],
};

const MOTIVATES: Record<SportId, { athlete: string; habit: string }> = {
  baseball_kr: { athlete: "최정", habit: "한 팀에서 20년 가까이 꾸준히 뛰며 통산 최다 홈런을 쌓았습니다." },
  baseball_world: { athlete: "오타니 쇼헤이", habit: "고등학생 때 목표를 81칸 계획표(만다라트)로 쪼개 하나씩 실천했습니다." },
  soccer_kr: { athlete: "박지성", habit: "작은 체격을 엄청난 활동량으로 이겨내 '두 개의 심장'이라 불렸습니다." },
  soccer_world: { athlete: "손흥민", habit: "어린 시절 아버지와 몇 년 동안 기본기 훈련만 반복했습니다." },
  nba: { athlete: "코비 브라이언트", habit: "남들이 자는 새벽에 먼저 나와 훈련하는 것으로 유명했습니다." },
  esports: { athlete: "페이커", habit: "10년 넘게 한 팀에서 뛰며 정상을 지켰습니다." },
};

const WORKOUTS: Record<SportId, { athleteFact: string; prescription: string }> = {
  baseball_kr: { athleteFact: "KBO 선수는 한 시즌에 144경기를 뜁니다.", prescription: "거울 앞에서 빈 스윙 30번만 하세요." },
  baseball_world: { athleteFact: "메이저리거는 한 시즌에 162경기를 뜁니다.", prescription: "거울 앞에서 빈 스윙 30번만 하세요." },
  soccer_kr: { athleteFact: "축구 선수는 한 경기에 약 10km를 뜁니다.", prescription: "당신은 1km만 뛰고 오세요." },
  soccer_world: { athleteFact: "축구 선수는 한 경기에 약 10km를 뜁니다.", prescription: "당신은 1km만 뛰고 오세요." },
  nba: { athleteFact: "NBA 선수는 정규시즌에만 82경기를 뜁니다.", prescription: "제자리 점프 20번이면 오늘은 합격입니다." },
  esports: { athleteFact: "프로게이머도 체력 관리로 운동을 따로 합니다.", prescription: "손목 말고 하체를 쓰세요. 스쿼트 20번." },
};

/** 이 파일에 있는 선수들의 출생 연도. AI가 이 선수를 고르면 출생 연도를 대조한다. */
export const KNOWN_BIRTH_YEARS: Record<string, number> = Object.fromEntries(
  Object.values(PEAKS)
    .flat()
    .map((p) => [shortName(p.athlete), p.birthYear]),
);

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** 배포 전 팀 검증 규칙: 모든 항목이 검증되면 verified만 쓴다. 지금은 전체를 쓴다. */
function usablePeaks(sport: SportId, extra: ExtraPeaks = {}): Peak[] {
  const all = PEAKS[sport];
  const verified = all.filter((p) => p.verified);
  return [...(verified.length >= 3 ? verified : all), ...(extra[sport] ?? [])];
}

/**
 * 리빌 선수 고르기. visit = 이 브라우저에서 이전에 판독한 횟수.
 * 처음(visit 0)에는 나이가 가장 가까운 슈퍼스타(fame 1)를 고른다.
 * 다시 올수록 "선택 온도"를 올린다: 나이 허용 폭을 넓히고(최대 ±4살), fame 2 선수의 불이익을 줄여 섞는다.
 */
export function pickPeak(
  choice: SportChoice,
  age: number,
  exclude: string[] = [],
  visit = 0,
  extra: ExtraPeaks = {},
): { sport: SportId; p: Peak } {
  const pool: { sport: SportId; p: Peak }[] = (choice === "any" ? [...SPORT_IDS] : [choice]).flatMap((s) =>
    usablePeaks(s, extra).map((p) => ({ sport: s, p })),
  );
  const excluded = new Set(exclude.map(shortName));
  const filtered = pool.filter((x) => !excluded.has(shortName(x.p.athlete)));
  const candidates = filtered.length ? filtered : pool;

  const v = Math.max(0, Math.floor(visit) || 0);
  const famePenalty = Math.max(0, 3 - v); // 처음에는 fame 2 선수를 3살 더 먼 것처럼 취급
  const spread = v === 0 ? 0 : Math.min(v + 1, 4); // 가장 좋은 후보보다 몇 살 더 먼 것까지 허용할지
  const cost = (x: { p: Peak }) => Math.abs(x.p.eventAge - age) + (x.p.fame === 2 ? famePenalty : 0);
  const minCost = Math.min(...candidates.map(cost));
  const near = candidates.filter((x) => cost(x) <= minCost + spread);
  // 가까울수록, 유명할수록 잘 뽑힌다
  const weights = near.map((x) => (x.p.fame === 1 ? 2 : 1) / (1 + cost(x) - minCost));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < near.length; i++) {
    r -= weights[i];
    if (r <= 0) return near[i];
  }
  return near[near.length - 1];
}

export function buildFallback(
  choice: SportChoice,
  age: number,
  exclude: string[] = [],
  visit = 0,
  extra: ExtraPeaks = {},
): JudgeResult {
  const { sport, p } = pickPeak(choice, age, exclude, visit, extra);
  const delta = p.eventAge - age;

  const comfortList = [...COMFORTS[sport]].sort((a, b) => Math.abs(a.lowAge - age) - Math.abs(b.lowAge - age));
  const c = comfortList[0];
  const cSubj = josa(shortName(c.athlete), "은/는");
  const m = MOTIVATES[sport];
  const name = shortName(p.athlete);

  return {
    reveal: {
      athlete: p.athlete,
      sport,
      athleteBirthYear: p.birthYear,
      eventYear: p.eventYear,
      eventAge: p.eventAge,
      delta,
      headline: buildHeadline(p.athlete, p.fact, p.eventAge, delta),
      shortFact: p.shortFact,
    },
    comfort: {
      ...c,
      line: `${c.lowAge}세의 ${cSubj} ${c.lowText.replace(/\.$/, "")}. 그런데 ${c.laterAge}세에 ${c.laterText.replace(/\.$/, "")}.`,
    },
    motivate: {
      athlete: m.athlete,
      habit: m.habit,
      line: `${m.athlete}의 습관: ${m.habit} 오늘 당신은 딱 하나만 가져가세요.`,
    },
    roast: {
      lines: shuffle(ROAST_POOL)
        .slice(0, 3)
        .map((l) => l.replace("{선수은는}", josa(name, "은/는"))),
    },
    workout: WORKOUTS[sport],
    confidence: "high",
    // 발굴 기록은 AI가 웹에서 찾은 것이라 출처와 AI 안내 문구를 붙인다
    sources: p.sources ?? [],
    source: p.sources?.length ? "ai" : "fallback",
  };
}
