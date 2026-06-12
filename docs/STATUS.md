# 진행 상황 (세션 인계 문서)

> 마지막 갱신: 2026-06-12
> 용도: 다른 PC/다음 세션에서 이어서 작업하기 위한 현재 위치 기록.
> 작업 재개 시 이 문서를 먼저 읽고, 끝나면 갱신할 것.

## 현재 위치

**Phase 3 (스킬 확장·경제 순환) — 구현 완료, 플레이테스트 대기**

- 코어+UI 전부 구현: 낚시/요리/연금술 스킬, 물약·버프(오프라인 경계 정산),
  약초 부산물, 상점(도구 업그레이드), 기존 스킬 티어 확장(아다만타이트/오리할콘),
  몬스터 트롤·와이번, 세이브 v4 마이그레이션
- 핵심 신규 메커니즘: **재료 대기** — 소비 작업(요리 등)은 재료가 떨어져도 공급
  작업이 활성이면 중단하지 않고 대기. 낚시+요리 동시 가동이 성립
- 테스트 50개 통과. 상세 구현 내역·문서 대비 변경점:
  [phases/phase-3-skills-economy.md](phases/phase-3-skills-economy.md)의 "진행 기록"
- Phase 3까지 커밋·push 완료 (원격: github.com/yeonju9/Winterforge)

## 다음 작업: Phase 3 플레이테스트 (사용자가 직접)

> 전체 잔여 작업 목록: [TODO.md](TODO.md) · 플레이 체크리스트: [playtest-checklist.md](playtest-checklist.md)

확인할 것 (DoD):
1. 골드 사용처가 생겼다 — 상점 업그레이드를 실제로 사고 싶은가
2. 낚시+요리 / 채집+연금술 등 슬롯 조합이 의미 있는 선택인가
3. 물약(버프)이 전투·채집 성과에 체감되는가
4. 오프라인 정산 중 버프 만료가 자연스러운가

테스트 도우미: `packages/core/scripts/test-save.mjs`
```
cd packages/core
node scripts/test-save.mjs economy   # Phase 3 경제 순환 테스트 스펙 (물약·재료·골드 보유)
node scripts/test-save.mjs wolf|goblin|orc   # Phase 2 전투 단계별
```
출력 JSON을 게임의 설정 → 세이브 가져오기에 붙여넣기. (dist 기준이라 데이터 수정 후엔 `npm run build` 먼저)

- Phase 2 플레이테스트(전투 흐름 확인)도 아직 안 봤음 — 같이 보면 됨
- 피드백 반영 후 DoD 체크 → Phase 3 종료 → 다음은 Phase 4 (계정·서버) 또는 밸런스 패스

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
