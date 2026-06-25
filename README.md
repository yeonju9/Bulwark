# Bulwark (불워크)

웹 기반 방치형 RPG. 몰려오는 몬스터 웨이브로부터 마을을 짓고 지키는,
Melvor Idle 스타일의 생활+전투 스킬 시뮬레이션을 목표로 한다.

## 아키텍처

```
idle-rpg/
├── packages/
│   └── core/        # 순수 TS 게임 시뮬레이션 엔진 (클라이언트·서버 공유)
├── apps/
│   ├── web/         # React + Vite 클라이언트
│   └── server/      # NestJS API 서버
```

핵심 설계 원칙: **시뮬레이션은 `(상태, 현재시각) → 새 상태`의 순수 함수다.**

- `core/simulate.ts`의 `simulate()`가 유일한 시뮬레이션 진입점. 실시간 틱(200ms)과
  오프라인 정산(최대 12시간)이 같은 코드로 처리된다.
- 플레이어 조작은 `core/commands.ts`의 커맨드(startAction/stopAction/sellItem)로만 상태를 바꾼다.
- 서버는 같은 `simulate()`를 실행해 세이브를 정산·검증한다. 이후 랭킹/거래소 등
  경쟁 요소가 들어가면 이 구조가 server-authoritative 치팅 방지의 기반이 된다.
- `Date.now()`는 코어 밖(웹 store, 서버 service)에서만 호출한다. 코어는 결정적(deterministic)으로 유지.

모듈 참조 방식:
- **web → core**: Vite alias로 TS 소스를 직접 참조 (코어 빌드 불필요, 수정 즉시 반영)
- **server → core**: 컴파일된 `packages/core/dist` 참조 (서버 실행 전 `npm run build -w @idle-rpg/core` 필요 — 루트 스크립트에 포함됨)

## 명령어

```bash
npm install          # 전체 워크스페이스 설치
npm run dev          # 웹 개발 서버 (http://localhost:5173)
npm run dev:server   # API 서버 (http://localhost:3000, 코어 빌드 포함)
npm test             # 코어 시뮬레이션 테스트
npm run typecheck    # 전체 타입 체크
npm run build        # 전체 빌드
```

## 현재 단계: Phase 2 (전투와 던전)

- 스킬 5종: 벌목 / 채광 / 대장기술 + 공격 / 체력 (전투)
- 전투: 결정적 기대값 전투 + 시드 난수 전리품. 사냥 = 슬롯 작업,
  음식 자동 섭취, HP 부족 시 죽기 전에 중단 (소프트 페널티)
- 던전: 준비해서 도전하는 단발 콘텐츠 (쿨다운 10분). 보상이 미스릴 티어 제작 관문
- 장비(무기/방어구), 도감, 캐릭터 패널
- 작업 슬롯: 1슬롯 시작, 총 레벨 40에서 2슬롯, 100에서 3슬롯
- 오프라인 진행 정산 (상한 12시간) — 전투 포함, 틱 누적과 완전 동일 (테스트 보장)
- localStorage 저장 + 세이브 백업/복원, 서버: 세이브 GET/PUT 골격

## 로드맵

Phase 단위 상세 계획은 [docs/ROADMAP.md](docs/ROADMAP.md) 참고.

0. ~~스캐폴딩 + 슬롯 시스템~~ ✅
1. 프로토타입 다듬기 (재미 검증) ← 지금 여기
2. 전투와 던전 → 3. 스킬 확장 → 4. 계정/서버 저장
5. 폴리시 → 6. 소프트 런칭 → 7. 라이브 운영 (시즌·거래소·월드보스)

## 아트 방침

유료 에셋 미사용. 프로토타입은 이모지 플레이스홀더, 이후 AI 생성(Gemini 등)으로
일관된 스타일의 아이콘 세트를 제작해 교체한다. 아이템/액션 정의의 `icon` 필드만
이미지 경로로 바꾸면 되도록 데이터 구조를 유지할 것.
