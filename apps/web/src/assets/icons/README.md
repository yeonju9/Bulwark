# 게임 아이콘 (직접 제작한 PNG/SVG 넣는 곳)

이 폴더에 그림 파일을 넣으면 빌드 시 자동으로 잡혀서, 게임의 해당 이모지 자리에
그림이 대신 렌더됩니다. **코드 수정 불필요** — 파일을 넣고/빼는 것만으로 동작합니다.

## 규칙

- 지원 형식: `.png` `.svg` `.webp` `.jpg`
- **파일명 = 엔티티 id** (확장자 제외). 예: `barracks.png`, `slime.svg`, `oak_log.png`
- 정사각형 권장(맵 건물은 64~128px, 칩/인벤토리는 32~48px면 충분).
- 배경 투명(PNG/SVG) 권장 — 잔디 맵 위에 자연스럽게 얹힘.

## 주요 id 모음

핵심만 적습니다. 전체 id는 `packages/core/src/data/*.ts` 의 각 정의 `id` 필드 참고.

### 건물 (`data/buildings.ts`)
`headquarters`(본부) · `barracks`(병영) · `rampart`(망루)
- 선택: `<id>_broken` (파손 상태 전용 그림). 없으면 일반 그림을 흑백 처리해 표시.

### 던전 (`data/stages.ts` 의 dungeons / `data/dungeons*`)
`thicket_burrow` · `wolf_hollow` · `goblin_den` · `orc_warcamp` …

### 몬스터 (`data/monsters.ts`)
`slime` · `boar` · `wolf` · `goblin` · `goblin_shaman` · `orc` …
- 웨이브 **침공 애니메이션**(마을로 돌격하는 몬스터)과 상세 패널에 같은 파일이 쓰입니다.

### 아이템 (`data/items.ts`)
`normal_log` · `oak_log` · `copper_bar` · `iron_bar` … (장비·재료·음식·물약 등)

## 동작 방식

`src/icons.ts` 가 이 폴더를 `import.meta.glob` 으로 스캔해 `id → URL` 맵을 만들고,
`<GameIcon id="barracks" emoji="⚔️" />` 가 파일이 있으면 그림, 없으면 이모지를 그립니다.
아직 `GameIcon` 으로 안 바꾼 화면은 기존 이모지를 그대로 씁니다(점진 교체 가능).
