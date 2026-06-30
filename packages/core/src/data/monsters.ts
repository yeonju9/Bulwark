import type { DungeonDef, DungeonId, MonsterDef, MonsterId } from '../types';

// 사냥터 몬스터는 이제 "웨이브 몬스터"로 재사용된다 (맵 단계 티어 테이블 — data/stages.ts).
// 캐릭터 직접 사냥은 Phase 3.5에서 마을 자동 웨이브 방어로 대체됨.
const monsterList: MonsterDef[] = [
  {
    id: 'slime', name: '슬라임', icon: '🟢', levelRequired: 1,
    hp: 15, attack: 2, defense: 0, attackIntervalMs: 2500, xp: 8,
    lootTable: [{ itemId: 'jelly', qty: 1, chance: 0.8 }],
  },
  {
    id: 'boar', name: '멧돼지', icon: '🐗', levelRequired: 5,
    hp: 50, attack: 14, defense: 3, attackIntervalMs: 2400, xp: 16,
    lootTable: [
      { itemId: 'leather', qty: 1, chance: 0.6 },
      { itemId: 'dried_meat', qty: 1, chance: 0.5 },
    ],
  },
  {
    id: 'wolf', name: '늑대', icon: '🐺', levelRequired: 10,
    hp: 78, attack: 20, defense: 6, attackIntervalMs: 2200, xp: 28,
    lootTable: [
      { itemId: 'leather', qty: 1, chance: 0.8 },
      { itemId: 'dried_meat', qty: 1, chance: 0.4 },
    ],
  },
  {
    id: 'goblin', name: '고블린', icon: '👺', levelRequired: 15,
    hp: 120, attack: 28, defense: 9, attackIntervalMs: 2400, xp: 42,
    lootTable: [
      { itemId: 'magic_stone', qty: 1, chance: 0.15 },
      { itemId: 'dried_meat', qty: 1, chance: 0.3 },
    ],
  },
  {
    id: 'goblin_shaman', name: '고블린 주술사', icon: '🧿', levelRequired: 22,
    hp: 150, attack: 33, defense: 11, attackIntervalMs: 2600, xp: 60,
    lootTable: [{ itemId: 'magic_stone', qty: 1, chance: 0.35 }],
  },
  {
    id: 'orc', name: '오크', icon: '👹', levelRequired: 30,
    hp: 240, attack: 49, defense: 15, attackIntervalMs: 2800, xp: 90,
    lootTable: [
      { itemId: 'magic_stone', qty: 1, chance: 0.4 },
      { itemId: 'leather', qty: 2, chance: 0.5 },
    ],
  },
  {
    id: 'troll', name: '트롤', icon: '🧟', levelRequired: 38,
    hp: 260, attack: 34, defense: 16, attackIntervalMs: 2800, xp: 130,
    lootTable: [
      { itemId: 'magic_stone', qty: 1, chance: 0.5 },
      { itemId: 'leather', qty: 2, chance: 0.6 },
      { itemId: 'dried_meat', qty: 1, chance: 0.3 },
    ],
  },
  {
    id: 'wyvern', name: '와이번', icon: '🐉', levelRequired: 48,
    hp: 400, attack: 46, defense: 22, attackIntervalMs: 3000, xp: 200,
    lootTable: [
      { itemId: 'wyvern_scale', qty: 1, chance: 0.5 },
      { itemId: 'magic_stone', qty: 1, chance: 0.6 },
      { itemId: 'leather', qty: 3, chance: 0.4 },
    ],
  },

  // ─── 던전 전용 몬스터 (웨이브 풀 재사용 아님 — 같은 레벨대보다 강함) ───
  {
    id: 'rat_king', name: '들쥐왕', icon: '🐀', levelRequired: 5,
    hp: 160, attack: 14, defense: 4, attackIntervalMs: 2400, xp: 70,
    lootTable: [], dungeonOnly: true,
  },
  {
    id: 'dire_wolf', name: '우두머리 늑대', icon: '🐺', levelRequired: 12,
    hp: 280, attack: 24, defense: 8, attackIntervalMs: 2200, xp: 110,
    lootTable: [], dungeonOnly: true,
  },
  {
    id: 'goblin_chief', name: '고블린 족장', icon: '👑', levelRequired: 20,
    hp: 420, attack: 40, defense: 13, attackIntervalMs: 2400, xp: 180,
    lootTable: [], dungeonOnly: true,
  },
  {
    id: 'orc_warlord', name: '오크 전쟁군주', icon: '🪓', levelRequired: 30,
    hp: 760, attack: 68, defense: 21, attackIntervalMs: 2800, xp: 320,
    lootTable: [], dungeonOnly: true,
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

/** 웨이브/사냥터에 나오는 필드 몬스터 (던전 전용 제외) */
export function fieldMonsters(): MonsterDef[] {
  return monsterList.filter((m) => !m.dungeonOnly);
}

// ─── 던전 (수동 공략 — 웨이브와 완전 별개) ───
// 최초 1회 클리어만 큰 보상 + 다음 티어 해금. 이후 반복은 소량 보상. 쿨다운 없음.
const dungeonList: DungeonDef[] = [
  {
    id: 'thicket_burrow', name: '들쥐 굴', icon: '🕳️', level: 5,
    description: '들판 아래 굴. 멧돼지 무리와 들쥐왕을 상대합니다. 첫 정복은 마을 방어의 첫 관문입니다.',
    monsters: ['boar', 'boar', 'rat_king'],
    firstRewards: [
      { itemId: 'leather', qty: 6, chance: 1 },
      { itemId: 'copper_bar', qty: 4, chance: 1 },
    ],
    repeatRewards: [{ itemId: 'leather', qty: 2, chance: 0.8 }],
  },
  {
    id: 'wolf_hollow', name: '늑대 골짜기', icon: '🏔️', level: 12,
    description: '늑대 떼가 도사린 골짜기. 우두머리 늑대를 처치하면 더 거센 웨이브가 해금됩니다.',
    monsters: ['wolf', 'wolf', 'dire_wolf'],
    firstRewards: [
      { itemId: 'leather', qty: 10, chance: 1 },
      { itemId: 'iron_bar', qty: 5, chance: 1 },
      { itemId: 'magic_stone', qty: 2, chance: 1 },
    ],
    repeatRewards: [{ itemId: 'leather', qty: 3, chance: 0.8 }],
  },
  {
    id: 'goblin_den', name: '고블린 소굴', icon: '🏰', level: 20,
    description: '고블린 무리와 주술사, 보스 족장을 연달아 상대합니다. 보급품과 장비를 갖추고 도전하세요.',
    monsters: ['goblin', 'goblin', 'goblin_shaman', 'goblin_chief'],
    firstRewards: [
      { itemId: 'mithril_core', qty: 1, chance: 1 },
      { itemId: 'magic_stone', qty: 4, chance: 1 },
    ],
    repeatRewards: [{ itemId: 'magic_stone', qty: 2, chance: 0.7 }],
  },
  {
    id: 'orc_warcamp', name: '오크 전초기지', icon: '⛺', level: 30,
    description: '오크 전사들과 전쟁군주가 버티는 전초기지. 시작의 마을 최강의 웨이브 티어를 해금합니다.',
    monsters: ['orc', 'orc', 'orc_warlord'],
    firstRewards: [
      { itemId: 'mithril_core', qty: 2, chance: 1 },
      { itemId: 'magic_stone', qty: 6, chance: 1 },
      { itemId: 'wyvern_scale', qty: 1, chance: 1 },
    ],
    repeatRewards: [{ itemId: 'magic_stone', qty: 3, chance: 0.7 }],
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
