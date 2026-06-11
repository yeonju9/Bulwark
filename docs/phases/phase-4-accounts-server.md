# Phase 4 — 계정과 서버 저장 (서비스화 1단계)

> 목표: "내 게임" → "서비스". 어느 기기에서나 이어서 플레이.
> 규모: 중간. 백엔드 본업 영역. 선행: Phase 2~3 (검증할 게임이 있어야 함 — Phase 3와 병행 가능)

## 1. 설계 결정

### 1-1. 계정 모델: 게스트 우선
- 첫 접속 즉시 플레이 (가입 화면 없음). 서버가 게스트 계정(UUID) 발급 → 클라 localStorage에 토큰
- Google OAuth는 **게스트의 승격**: 기존 진행을 계정에 귀속. 로그인 = 다른 기기에서 이어하기
- 인증 토큰: JWT (access 단기 + refresh). NestJS `@nestjs/passport` + `passport-google-oauth20`

### 1-2. 저장 모델: 클라이언트 주도 동기화, 서버 정본
- 클라는 기존 localStorage 저장 유지 (오프라인 우선) + **주기 동기화** (60초 + 중요 이벤트 시)
- 서버는 마지막으로 **검증에 통과한 상태**를 정본으로 보관
- 충돌(다중 기기): `lastTickAt`이 더 미래인 쪽 승리 (단순하게 시작). 동시 접속 잠금은 P1

### 1-3. 검증 전략 (안티치트의 뼈대)
서버는 클라를 믿지 않는다. PUT된 세이브에 대해:
1. `migrateSave` 스키마 검증
2. `lastTickAt ≤ 서버시각 + 허용오차(60s)` — 시간 조작 차단
3. **도달 가능성 검사**: 직전 정본에서 `simulate(정본, 클라.lastTickAt)`를 돌려
   XP·아이템 누계가 클라 상태 이상이어야 함 (클라 ≤ 서버 재계산 결과).
   슬롯·액션 선택은 클라 자유이므로 "최대 가능 수율"과 비교 (각 스킬 최고 효율 액션 기준 상한)
4. 위반 시: 세이브 거부 + 직전 정본 회신 (클라는 정본으로 롤백)

> 완벽한 검증은 목표가 아니다. "명백히 불가능한 진행"을 막으면 Phase 7 랭킹에 충분.

### 1-4. 스택
- DB: PostgreSQL + **Prisma** (스키마 마이그레이션 도구 포함, 1인 개발에 마찰 최소)
- 비밀값: `.env` (`@nestjs/config`), 저장소에는 `.env.example`만
- 로컬 개발: `docker-compose.yml`로 Postgres 1컨테이너

## 2. DB 스키마 (Prisma 초안)

```prisma
model User {
  id         String   @id @default(uuid())
  googleSub  String?  @unique     // OAuth 승격 시 채움
  createdAt  DateTime @default(now())
  save       Save?
}

model Save {
  userId     String   @id
  user       User     @relation(fields: [userId], references: [id])
  version    Int                  // 세이브 스키마 버전
  state      Json                 // GameState 통째로 (초기엔 정규화하지 않는다)
  lastTickAt BigInt
  updatedAt  DateTime @updatedAt
}
```
> 상태를 Json 한 덩어리로 — 랭킹(Phase 7)에서 필요한 필드만 컬럼/별도 테이블로 발췌한다.

## 3. 작업 분해 (순서대로)

### 3-1. 인프라
- [ ] `docker-compose.yml` (postgres:16) + `apps/server` Prisma 셋업, `.env.example`
- [ ] CI 준비가 안 되어 있다면 보류 — 로컬 우선

### 3-2. 인증
- [ ] `AuthModule`: `POST /auth/guest` (UUID 계정 생성 → JWT 발급)
- [ ] Google OAuth: `GET /auth/google` → 콜백 → 게스트 승격 or 기존 계정 로그인
- [ ] `JwtAuthGuard` — saves 라우트 보호 (`:userId` 파라미터 제거, 토큰에서 식별)

### 3-3. 저장 동기화
- [ ] SavesService를 Prisma로 교체 (`GET /save`, `PUT /save`)
- [ ] 검증 파이프라인 (1-3의 4단계) — `core`의 simulate 재사용
- [ ] "최대 가능 수율" 계산기를 core에 추가 (`maxPossibleGains(state, elapsed)`)
      — 클라와 검증 로직이 같은 패키지에 있어 사양 불일치가 원리적으로 불가능
- [ ] 클라: `web/src/sync.ts` — 60초 주기 PUT, 실패 시 백오프, 시작 시 GET 비교
      (서버 lastTickAt > 로컬이면 서버 채택 + "다른 기기 진행을 불러왔습니다" 토스트)
- [ ] 로그인 UI: 설정 패널에 "Google로 계정 연동" + 연동 상태 표시

### 3-4. 운영 준비 (P1~P2)
- [ ] 다중 기기 동시 접속: 마지막 쓰기 승리 유지 + 클라에 "다른 기기에서 접속됨" 안내
- [ ] Rate limit (`@nestjs/throttler`), 요청 로깅 (nestjs-pino 등 구조적 로그)
- [ ] 세이브 백업: updatedAt 기준 일일 스냅샷 테이블 (실수 복구용, 보존 7일)

## 4. 테스트 계획
- 검증 파이프라인 단위 테스트: 정상 진행 통과 / 시간 조작 거부 / XP 인플레 거부 / 아이템 주입 거부
- 승격 시나리오: 게스트 진행 → OAuth → 다른 브라우저 로그인 → 진행 일치
- e2e (supertest): guest → put save → get save 왕복

## 5. 완료 기준 (DoD)
- [ ] PC에서 플레이 → 다른 브라우저에서 로그인 → 이어서 플레이
- [ ] 조작된 세이브(시간 조작·아이템 주입)가 거부되고 클라가 정본으로 롤백된다
- [ ] 서버 재시작 후 데이터 유지
- [ ] 토큰 만료/갱신이 플레이를 끊지 않는다

## 6. 리스크 / 주의
- OAuth 콜백 URL은 배포 도메인 확정 전이면 localhost로만 — Phase 6에서 도메인 추가
- 검증 로직 과투자 금지: 상한 비교(3단계)면 충분. 정밀 리플레이 검증은 백로그
- BigInt(lastTickAt) ↔ JSON 직렬화 주의 (Prisma Json 안에는 number로 저장됨 — epoch ms는 2^53 이내라 안전)
