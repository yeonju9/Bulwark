import type { GameState, MapStageDef, WaveTierDef } from '../types';

/**
 * 맵 단계 정의. 단계마다 자체 웨이브 티어 테이블·던전·UI 테마를 가진다.
 * 우선 1단계 "시작의 마을"만 구현 (2~5단계는 후속).
 * 티어는 던전 최초 클리어 수로 해금되고, 유저는 해금 범위 안에서 직접 선택한다.
 * 난이도 ∝ 보상(rewardMultiplier).
 */
const stageList: MapStageDef[] = [
  {
    stage: 1,
    name: '시작의 마을',
    themeClass: 's1',
    dungeons: ['thicket_burrow', 'wolf_hollow', 'goblin_den', 'orc_warcamp'],
    tiers: [
      { tier: 1, name: '들판의 소란', monsters: ['slime', 'slime'], rewardMultiplier: 1, unlockClears: 0 },
      { tier: 2, name: '멧돼지 떼', monsters: ['boar', 'boar'], rewardMultiplier: 1.5, unlockClears: 1 },
      { tier: 3, name: '늑대 무리', monsters: ['wolf', 'wolf'], rewardMultiplier: 2, unlockClears: 2 },
      { tier: 4, name: '고블린 습격', monsters: ['goblin', 'goblin', 'goblin_shaman'], rewardMultiplier: 3, unlockClears: 3 },
      { tier: 5, name: '오크 침공', monsters: ['orc', 'orc'], rewardMultiplier: 4.5, unlockClears: 4 },
    ],
  },
];

export const STAGES: ReadonlyMap<number, MapStageDef> = new Map(stageList.map((s) => [s.stage, s]));

export function getStage(stage: number): MapStageDef {
  const s = STAGES.get(stage);
  if (!s) throw new Error(`Unknown map stage: ${stage}`);
  return s;
}

export function allStages(): MapStageDef[] {
  return stageList;
}

export function currentStage(state: GameState): MapStageDef {
  return getStage(state.mapStage);
}

/** 현재 단계에서 최초 클리어한 던전 수 (티어 해금 기준) */
export function clearedDungeonCount(state: GameState): number {
  const stage = currentStage(state);
  return stage.dungeons.filter((id) => (state.dungeonClears[id] ?? 0) > 0).length;
}

/** 현재 단계에서 해금된 최고 티어 번호 (선택 가능 상한) */
export function unlockedTier(state: GameState): number {
  const stage = currentStage(state);
  const cleared = clearedDungeonCount(state);
  let max = 1;
  for (const t of stage.tiers) {
    if (t.unlockClears <= cleared) max = Math.max(max, t.tier);
  }
  return max;
}

/** 현재 선택된 티어 정의. 해금 범위를 벗어났으면 해금 상한으로 클램프 */
export function currentTier(state: GameState): WaveTierDef {
  const stage = currentStage(state);
  const cap = unlockedTier(state);
  const tier = Math.max(1, Math.min(cap, state.waveTier));
  return stage.tiers.find((t) => t.tier === tier) ?? stage.tiers[0];
}
