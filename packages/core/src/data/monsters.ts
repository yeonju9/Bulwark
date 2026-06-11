import type { ActionDef, DungeonDef, DungeonId, MonsterDef, MonsterId } from '../types';

const monsterList: MonsterDef[] = [
  {
    id: 'slime', name: '슬라임', icon: '🟢', levelRequired: 1,
    hp: 15, attack: 2, defense: 0, attackIntervalMs: 2500, xp: 8,
    lootTable: [{ itemId: 'jelly', qty: 1, chance: 0.8 }],
  },
  {
    id: 'boar', name: '멧돼지', icon: '🐗', levelRequired: 5,
    hp: 30, attack: 5, defense: 2, attackIntervalMs: 2400, xp: 16,
    lootTable: [
      { itemId: 'leather', qty: 1, chance: 0.6 },
      { itemId: 'dried_meat', qty: 1, chance: 0.5 },
    ],
  },
  {
    id: 'wolf', name: '늑대', icon: '🐺', levelRequired: 10,
    hp: 50, attack: 9, defense: 4, attackIntervalMs: 2200, xp: 28,
    lootTable: [
      { itemId: 'leather', qty: 1, chance: 0.8 },
      { itemId: 'dried_meat', qty: 1, chance: 0.4 },
    ],
  },
  {
    id: 'goblin', name: '고블린', icon: '👺', levelRequired: 15,
    hp: 75, attack: 12, defense: 6, attackIntervalMs: 2400, xp: 42,
    lootTable: [
      { itemId: 'magic_stone', qty: 1, chance: 0.15 },
      { itemId: 'dried_meat', qty: 1, chance: 0.3 },
    ],
  },
  {
    id: 'goblin_shaman', name: '고블린 주술사', icon: '🧿', levelRequired: 22,
    hp: 100, attack: 18, defense: 8, attackIntervalMs: 2600, xp: 60,
    lootTable: [{ itemId: 'magic_stone', qty: 1, chance: 0.35 }],
  },
  {
    id: 'orc', name: '오크', icon: '👹', levelRequired: 30,
    hp: 160, attack: 26, defense: 12, attackIntervalMs: 2800, xp: 90,
    lootTable: [
      { itemId: 'magic_stone', qty: 1, chance: 0.4 },
      { itemId: 'leather', qty: 2, chance: 0.5 },
    ],
  },
  {
    id: 'goblin_chief', name: '고블린 족장', icon: '👑', levelRequired: 15,
    hp: 250, attack: 22, defense: 10, attackIntervalMs: 2400, xp: 150,
    lootTable: [],
    dungeonOnly: true,
  },
];

export const MONSTERS: ReadonlyMap<MonsterId, MonsterDef> = new Map(
  monsterList.map((m) => [m.id, m]),
);

export function getMonster(id: MonsterId): MonsterDef {
  const monster = MONSTERS.get(id);
  if (!monster) throw new Error(`Unknown monster: ${id}`);
  return monster;
}

/** 사냥터 몬스터 → 전투 액션 자동 생성 (사이클 시간은 스탯에서 동적 계산되므로 0) */
export const HUNT_ACTIONS: ActionDef[] = monsterList
  .filter((m) => !m.dungeonOnly)
  .map((m) => ({
    id: `hunt_${m.id}`,
    skillId: 'attack' as const,
    name: `${m.name} 사냥`,
    icon: m.icon,
    levelRequired: m.levelRequired,
    durationMs: 0,
    xp: m.xp,
    outputs: [],
    combat: { monsterId: m.id },
  }));

const dungeonList: DungeonDef[] = [
  {
    id: 'goblin_den',
    name: '고블린 소굴',
    icon: '🏰',
    description: '고블린 무리와 보스 족장을 연달아 상대합니다. 음식과 장비를 갖추고 도전하세요.',
    monsters: ['goblin', 'goblin', 'goblin_shaman', 'goblin_chief'],
    rewards: [
      { itemId: 'mithril_core', qty: 1, chance: 1 },
      { itemId: 'magic_stone', qty: 3, chance: 1 },
      { itemId: 'dried_meat', qty: 5, chance: 0.5 },
    ],
  },
];

export const DUNGEONS: ReadonlyMap<DungeonId, DungeonDef> = new Map(
  dungeonList.map((d) => [d.id, d]),
);

export function getDungeon(id: DungeonId): DungeonDef {
  const dungeon = DUNGEONS.get(id);
  if (!dungeon) throw new Error(`Unknown dungeon: ${id}`);
  return dungeon;
}

export function allDungeons(): DungeonDef[] {
  return dungeonList;
}

export function huntableMonsters(): MonsterDef[] {
  return monsterList.filter((m) => !m.dungeonOnly);
}
