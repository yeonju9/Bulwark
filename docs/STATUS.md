# 진행 상황 (세션 인계 문서)

> 마지막 갱신: 2026-06-13
> 용도: 다른 PC/다음 세션에서 이어서 작업하기 위한 현재 위치 기록.
> 작업 재개 시 이 문서를 먼저 읽고, 끝나면 갱신할 것.

## 현재 위치

**Phase 3.5 (마을 방어 전환) — 설계 합의 완료, UI 테마 시안 결정 대기**

게임 방향 전환 합의됨: 캐릭터 전투 → **마을 방어** (맵 중앙 화면, 마을 3×3 건설,
자동 웨이브 침공, 맵 위 던전). 확정 설계 전체와 구현 순서 7단계는
[phases/phase-3.5-village-defense.md](phases/phase-3.5-village-defense.md) 참고. 코드는 아직 미수정.

## 다음 작업: UI 테마 결정 → Phase 3.5 구현

1. **테마 시안 재논의** — `docs/mockups/map-theme-variants.html` (클래식 RPG 10종)을
   만들었으나 사용자 마음에 드는 것 없음. 새 시안을 더 만들거나 조합/조정 필요.
   기본 화면 구성 자체는 `docs/mockups/map-main-screen.html`로 합의 완료
2. 테마 확정 후 phase-3.5 문서의 구현 순서 1번(코어 v5 마이그레이션)부터 착수
   - 테마와 코어 구현은 독립적이라, 원하면 코어부터 먼저 시작해도 됨
3. 보류 중 확인사항: 오프라인 정산 "50%"를 보상 50%로 해석함, 던전 쿨다운 제거함
   — 사용자가 이의 없었으나 구현 전 한 번 더 확인하면 좋음

## 이전 위치 (Phase 3 — 보류)

**Phase 3 (스킬 확장·경제 순환) — 구현 완료, 플레이테스트는 방향 전환으로 보류**

- 코어+UI 전부 구현: 낚시/요리/연금술 스킬, 물약·버프(오프라인 경계 정산),
  약초 부산물, 상점(도구 업그레이드), 기존 스킬 티어 확장(아다만타이트/오리할콘),
  몬스터 트롤·와이번, 세이브 v4 마이그레이션
- 핵심 신규 메커니즘: **재료 대기** — 소비 작업(요리 등)은 재료가 떨어져도 공급
  작업이 활성이면 중단하지 않고 대기. 낚시+요리 동시 가동이 성립
- 테스트 50개 통과. 상세 구현 내역·문서 대비 변경점:
  [phases/phase-3-skills-economy.md](phases/phase-3-skills-economy.md)의 "진행 기록"
- Phase 3까지 커밋·push 완료 (원격: github.com/yeonju9/Winterforge)

보류된 Phase 3 플레이테스트 DoD (Phase 3.5가 전투·경제를 바꾸므로 전환 후 재평가):
1. 골드 사용처가 생겼다 — 상점 업그레이드를 실제로 사고 싶은가
2. 낚시+요리 / 채집+연금술 등 슬롯 조합이 의미 있는 선택인가
3. 물약(버프)이 전투·채집 성과에 체감되는가
4. 오프라인 정산 중 버프 만료가 자연스러운가

> 전체 잔여 작업 목록: [TODO.md](TODO.md) · 플레이 체크리스트: [playtest-checklist.md](playtest-checklist.md)

테스트 도우미: `packages/core/scripts/test-save.mjs`
```
cd packages/core
node scripts/test-save.mjs economy   # Phase 3 경제 순환 테스트 스펙 (물약·재료·골드 보유)
node scripts/test-save.mjs wolf|goblin|orc   # Phase 2 전투 단계별
```
출력 JSON을 게임의 설정 → 세이브 가져오기에 붙여넣기. (dist 기준이라 데이터 수정 후엔 `npm run build` 먼저)

- Phase 2 플레이테스트(전투 흐름)도 안 봤으나, 전투 자체가 Phase 3.5에서 마을 방어로 재편되므로 의미 축소

## 다른 PC에서 환경 재구축

1. 저장소 가져오기 (원격이 없다면 먼저 GitHub 등에 push 필요)
2. `npm install` (Node 20+)
3. `npm run dev` → http://localhost:5173
4. 게임 세이브는 localStorage라 PC 간 이동 안 됨 → 설정 → 내보내기/가져오기 또는 test-save 사용
5. 검증: `npm test` (50개), `npm run typecheck`, `npm run balance -w @idle-rpg/core`

## 합의된 작업 방식 (다른 환경의 Claude를 위해)

- 커밋은 사용자가 직접. Claude는 **한국어 커밋 메시지 제안만**
- Phase 단위 진행, 각 Phase 문서의 DoD 체크 후 종료. 스코프 확장은 ROADMAP 백로그로
- 밸런스 수치 변경 시 `npm run balance` 재실행해 곡선 확인
- 코어 결정성 유지: 코어에 Date.now()/Math.random() 금지 (난수는 시드 주입)
