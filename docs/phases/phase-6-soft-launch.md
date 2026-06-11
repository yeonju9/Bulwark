# Phase 6 — 소프트 런칭

> 목표: 실제 유저의 피드백 루프를 연다. 기능 개발 최소, 배포·계측·공개 작업.
> 규모: 작음 (1~2주). 선행: Phase 5

## 1. 설계 결정

| 항목 | 선택 | 비고 |
|---|---|---|
| 프론트 호스팅 | Cloudflare Pages | 무료, 글로벌 CDN, vite 빌드 그대로 |
| 서버 호스팅 | Fly.io 또는 Railway | 컨테이너 1개 + Postgres. 월 $5~10 |
| 도메인 | 1개 구매 (~$12/년) | `game.example.com` / `api.example.com` 분리 |
| 에러 트래킹 | Sentry 무료 티어 | web + server 양쪽 |
| 지표 | 자체 이벤트 테이블 (Postgres) | 외부 analytics 도입은 보류 — 필요 지표가 적음 |

## 2. 작업 분해 (순서대로)

### 2-1. 배포 파이프라인
- [ ] `apps/server/Dockerfile` (멀티스테이지: core 빌드 → server 빌드 → slim 런타임)
- [ ] Fly.io/Railway 배포 + Postgres 프로비저닝 + Prisma migrate 배포 절차 문서화
- [ ] Cloudflare Pages: `apps/web` 빌드 연결, `VITE_API_URL` 환경 변수화
- [ ] CORS를 배포 도메인으로 제한, OAuth 콜백 URL 추가
- [ ] `docs/DEPLOY.md` — 배포/롤백 절차 기록 (미래의 내가 읽을 문서)

### 2-2. 계측
- [ ] Sentry SDK (web: 에러+소스맵 업로드 / server: 예외 필터 연동)
- [ ] 핵심 지표 이벤트: `session_start`, `tutorial_step`, `level_up`, `dungeon_clear`
      → `events` 테이블 (userId, name, props Json, at)
- [ ] 일일 지표 쿼리 저장: DAU, D1/D7 리텐션, 튜토리얼 완주율, 평균 세션 길이
      (대시보드 도구는 SQL + 스프레드시트면 충분 — Grafana는 백로그)

### 2-3. 공개 준비
- [ ] 게임 이름 확정 + 파비콘/OG 이미지 (AI 생성 파이프라인 재사용)
- [ ] 랜딩 요소: 게임 화면이 곧 랜딩 (별도 랜딩 페이지 안 만듦)
- [ ] 인게임 피드백 링크 (설정 패널 → Google Form)
- [ ] 개인정보처리방침 1페이지 (OAuth 사용 시 필요) — 수집 항목 최소라 간단
- [ ] itch.io 등록 (iframe 임베드 가능 여부 확인, 안 되면 링크 카드)

### 2-4. 공개
- [ ] 지인 5~10명 비공개 베타 1주 → 치명 이슈 수정
- [ ] r/incremental_games "Feedback Friday" 스레드, 한국 인디게임 커뮤니티 1~2곳
- [ ] 첫 주는 매일 지표·에러 확인, 핫픽스 우선

## 3. 완료 기준 (DoD)
- [ ] 모르는 사람이 URL로 접속해 플레이하고 있다 (지표로 확인)
- [ ] 에러와 리텐션을 볼 수 있다
- [ ] 배포→롤백을 문서대로 수행할 수 있다
- [ ] 피드백이 한 곳(폼)에 쌓인다

## 4. 리스크 / 주의
- **공개 직후 밸런스 불만이 가장 많이 온다** — 수치는 데이터 파일에 있으므로 빠른 패치 가능.
  세이브 호환만 깨지 않으면 과감하게 조정
- 서버 비용 알람 설정 (예상 밖 트래픽 대비)
- 피드백 전부에 대응하지 말 것 — 반복되는 것만. 1회성 의견은 백로그
