# CLAUDE.md

젝커톤 2026 팀 프로젝트 **GAP** (배포 이름 gap-motivation). 선수와 나 사이의 차이를 보여주고 오늘 운동할 동기를 주는 모바일 웹 서비스다. 나이와 종목을 넣으면 같은 나이에 선수가 해낸 기록을 보여주고, 위로·동기부여·독설 중 하나와 오늘의 운동 처방, 공유용 선수 카드로 끝난다.

판독은 기본이 하이브리드(`JUDGE_SOURCE=hybrid`)다. 사실은 `lib/fallback.ts`의 준비된 기록에서 고르고, AI는 `lib/hybrid.ts`에서 그 사실로 문구만 쓴다. 웹 검색 판독(`ai`)은 사실 오류 때문에 기본에서 뺐다 (`docs/spec.md` 2절 실측 결과).

@AGENTS.md

## 먼저 읽을 문서

- `docs/spec.md` — 구현 명세. 화면(5절), 프롬프트와 API(7절), 카드(9절), 디자인(10절), 개발 지침(13절). **작업 전 해당 절을 읽는다.**
- `docs/intent.md` — 의도, 톤, 하지 않을 것. 기능을 넣을지 판단할 때 본다.
- `docs/fallback.md` — AI 실패 시 쓰는 비상용 결과 데이터.
- 문서와 코드가 다르면 문서를 기준으로 하고, 문서를 바꿔야 하면 코드와 같은 커밋에서 고친다.

## 명령어

```bash
npm run dev     # 개발 서버
npm run build   # 배포 전 빌드 확인
npm run lint
```

## 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, 배포는 Vercel
- AI: OpenAI 공식 SDK `openai`, Responses API + 웹 검색 도구, `zod` 스키마로 structured outputs
- 카드 이미지 `html-to-image`, 아이콘 `@remixicon/react`
- 로그인, 사용자 DB 없음. 실시간 발굴 기록만 Upstash Redis에 쌓는다 (`lib/store.ts`, `docs/spec.md` 7.9)

## 규칙

- **OpenAI 호출은 서버(`app/api/judge/route.ts`)에서만.** `OPENAI_API_KEY`를 클라이언트 코드, `NEXT_PUBLIC_` 변수, 로그에 넣지 않는다.
- AI 응답은 스키마 검증과 `docs/spec.md` 7.6 검증을 통과한 것만 화면에 쓴다. 실패, 타임아웃(25초)은 항상 비상용 결과로 이어져야 하고 화면이 멈추면 안 된다.
- 프롬프트(`lib/prompt.ts`)를 고치면 `docs/spec.md` 7.2도 같이 고친다.
- 색, 간격, 모서리는 `app/globals.css`의 토큰만 쓴다. Tailwind에서는 `bg-bg`, `bg-surface`, `text-title`, `text-body`, `text-caption`, `bg-primary`, `text-onprimary` 같은 토큰 이름을 쓰고 hex를 직접 쓰지 않는다.
- 모든 화면은 402px 모바일 컬럼 안에 그린다. 컴포넌트 이름과 규격은 피그마 디자인 시스템(`docs/spec.md` 10.5)을 따른다.
- 화면 문구는 한국어 존댓말, 짧은 문장. 독설은 사용자의 행동만 겨냥하고 나이·외모·성별 등은 건드리지 않는다 (`docs/intent.md` 8절).
- 선수 사진, 구단 엠블럼은 쓰지 않는다.

## 커밋

- 메시지는 `feat:`, `fix:`, `docs:`, `chore:` 접두어 + 한국어 한 줄.
- **커밋 메시지와 PR 설명에 Claude를 공동 작업자로 넣지 않는다.** `Co-Authored-By: Claude ...` 줄과 "Generated with Claude Code" 문구를 쓰지 않는다.
- `.env.local` 등 키가 든 파일은 커밋하지 않는다. 새 환경 변수는 `.env.example`에 빈 값으로 추가한다.
