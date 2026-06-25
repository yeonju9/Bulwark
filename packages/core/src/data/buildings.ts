import type { BuildingDef, BuildingId, BuildingSlot, ItemStack } from '../types';

/**
 * 마을 방어 구조물.
 * - 본부(headquarters): 3×3 중앙(index 4) 고정. 기본 HP/공/방 제공, 파손되지 않음.
 * - 병영(barracks): 빈 터에 건설하는 공격 건물. 같은 건물 중복 건설 가능(효과 누적).
 * 수치는 balance 스크립트로 잡는다(웨이브 손익표 참고).
 */
const list: BuildingDef[] = [
  {
    id: 'headquarters',
    name: '본부',
    icon: '🏛️',
    description: '마을의 심장. 기본 체력·공격·방어를 제공하며 절대 파손되지 않습니다.',
    hp: 150,
    attack: 5,
    defense: 3,
    fixed: true,
  },
  {
    id: 'barracks',
    name: '병영',
    icon: '⚔️',
    description: '수비대를 훈련시켜 마을 공격력을 올립니다. 빈 터에 여러 채 지을 수 있습니다.',
    hp: 0,
    attack: 12,
    defense: 0,
    fixed: false,
    buildGold: 150,
    buildItems: [
      { itemId: 'normal_log', qty: 10 },
      { itemId: 'copper_bar', qty: 4 },
    ],
  },
  {
    id: 'rampart',
    name: '망루',
    icon: '🗼',
    description: '궁수가 배치되어 마을 체력과 방어를 함께 올립니다. 빈 터에 건설합니다.',
    hp: 60,
    attack: 3,
    defense: 4,
    fixed: false,
    buildGold: 220,
    buildItems: [
      { itemId: 'oak_log', qty: 8 },
      { itemId: 'iron_bar', qty: 4 },
    ],
  },
];

export const BUILDINGS: ReadonlyMap<BuildingId, BuildingDef> = new Map(list.map((b) => [b.id, b]));

export function getBuilding(id: BuildingId): BuildingDef {
  const b = BUILDINGS.get(id);
  if (!b) throw new Error(`Unknown building: ${id}`);
  return b;
}

/** 빈 터에 건설 가능한 건물 (본부 등 fixed 제외) */
export function buildableBuildings(): BuildingDef[] {
  return list.filter((b) => !b.fixed);
}

export const HQ_ID = 'headquarters';
export const HQ_CELL = 4; // 3×3 중앙

/** 새 마을의 건물터: 중앙에 본부만, 나머지는 빈 터 */
export function initialBuildings(): (BuildingSlot | null)[] {
  const cells: (BuildingSlot | null)[] = Array.from({ length: 9 }, () => null);
  cells[HQ_CELL] = { id: HQ_ID, damaged: false };
  return cells;
}

/** 손상된(파손) 건물 수리 비용 — 건설 비용의 절반(올림) */
export function repairCost(id: BuildingId): { gold: number; items: ItemStack[] } {
  const b = getBuilding(id);
  return {
    gold: Math.ceil((b.buildGold ?? 0) / 2),
    items: (b.buildItems ?? []).map((s) => ({ itemId: s.itemId, qty: Math.ceil(s.qty / 2) })),
  };
}

// ─── 성벽 외곽 링 ───────────────────────────────────────────────
// 칸을 차지하지 않는 별도 강화 레벨. 레벨↑ → 마을 최대 HP·방어력 누적 증가.
// 웨이브 패배 시 가장 먼저 무너진다(레벨 1 하락).

export const MAX_WALL_LEVEL = 10;
export const WALL_HP_PER_LEVEL = 50;
export const WALL_DEFENSE_PER_LEVEL = 3;

/** 성벽 레벨이 주는 마을 스탯 (누적) */
export function wallStats(level: number): { hp: number; defense: number } {
  const lv = Math.max(0, Math.min(MAX_WALL_LEVEL, level));
  return { hp: lv * WALL_HP_PER_LEVEL, defense: lv * WALL_DEFENSE_PER_LEVEL };
}

/**
 * 성벽 레벨 currentLevel → currentLevel+1 강화 비용. 최대 레벨이면 null.
 * 골드·자원 모두 지수 증가 — 후반 자원 싱크.
 */
export function wallReinforceCost(currentLevel: number): { gold: number; items: ItemStack[] } | null {
  if (currentLevel >= MAX_WALL_LEVEL) return null;
  const next = currentLevel + 1;
  return {
    gold: 120 * next * next,
    items: [
      { itemId: 'normal_log', qty: 8 * next },
      { itemId: 'copper_bar', qty: 3 * next },
    ],
  };
}
