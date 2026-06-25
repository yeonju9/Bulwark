import type { ItemDef, ItemId } from '../types';

const list: ItemDef[] = [
  // 벌목 산출물
  { id: 'normal_log', name: '통나무', icon: '🌲', sellPrice: 1 },
  { id: 'oak_log', name: '참나무 통나무', icon: '🌰', sellPrice: 5 },
  { id: 'maple_log', name: '단풍나무 통나무', icon: '🍁', sellPrice: 15 },
  { id: 'yew_log', name: '주목 통나무', icon: '🌲', sellPrice: 40 },
  { id: 'magic_log', name: '마법나무 통나무', icon: '🌟', sellPrice: 80 },
  { id: 'ancient_log', name: '고대나무 통나무', icon: '🌳', sellPrice: 130 },

  // 채광 산출물
  { id: 'copper_ore', name: '구리 광석', icon: '🥌', sellPrice: 2 },
  { id: 'iron_ore', name: '철 광석', icon: '🥌', sellPrice: 8 },
  { id: 'silver_ore', name: '은 광석', icon: '🥌', sellPrice: 15 },
  { id: 'mithril_ore', name: '미스릴 광석', icon: '💎', sellPrice: 25 },
  { id: 'adamantite_ore', name: '아다만타이트 광석', icon: '🟩', sellPrice: 45 },
  { id: 'orichalcum_ore', name: '오리할콘 광석', icon: '🟨', sellPrice: 70 },

  // 제련 산출물
  { id: 'copper_bar', name: '구리 주괴', icon: '🟧', sellPrice: 6 },
  { id: 'iron_bar', name: '철 주괴', icon: '⬜', sellPrice: 20 },
  { id: 'silver_bar', name: '은 주괴', icon: '⬜', sellPrice: 35 },
  { id: 'mithril_bar', name: '미스릴 주괴', icon: '🟦', sellPrice: 60 },
  { id: 'adamantite_bar', name: '아다만타이트 주괴', icon: '🟩', sellPrice: 100 },
  { id: 'orichalcum_bar', name: '오리할콘 주괴', icon: '🟨', sellPrice: 160 },

  // 무기
  { id: 'copper_sword', name: '구리 검', icon: '🗡️', sellPrice: 25, equip: { slot: 'weapon', attack: 4, levelRequired: 1 } },
  { id: 'iron_sword', name: '철 검', icon: '⚔️', sellPrice: 80, equip: { slot: 'weapon', attack: 10, levelRequired: 10 } },
  { id: 'silver_sword', name: '은 검', icon: '🤺', sellPrice: 150, equip: { slot: 'weapon', attack: 15, levelRequired: 18 } },
  { id: 'mithril_sword', name: '미스릴 검', icon: '🔱', sellPrice: 240, equip: { slot: 'weapon', attack: 24, levelRequired: 30 } },
  { id: 'adamantite_sword', name: '아다만타이트 검', icon: '🗡️', sellPrice: 520, equip: { slot: 'weapon', attack: 34, levelRequired: 40 } },
  { id: 'orichalcum_sword', name: '오리할콘 검', icon: '⚜️', sellPrice: 950, equip: { slot: 'weapon', attack: 46, levelRequired: 50 } },

  // 방어구
  { id: 'leather_armor', name: '가죽 갑옷', icon: '🦺', sellPrice: 40, equip: { slot: 'armor', defense: 4, levelRequired: 1 } },
  { id: 'iron_armor', name: '철 갑옷', icon: '🛡️', sellPrice: 120, equip: { slot: 'armor', defense: 9, levelRequired: 12 } },
  { id: 'mithril_armor', name: '미스릴 갑옷', icon: '🎽', sellPrice: 320, equip: { slot: 'armor', defense: 16, levelRequired: 28 } },
  { id: 'adamantite_armor', name: '아다만타이트 갑옷', icon: '🥋', sellPrice: 680, equip: { slot: 'armor', defense: 24, levelRequired: 40 } },
  { id: 'orichalcum_armor', name: '오리할콘 갑옷', icon: '👘', sellPrice: 1200, equip: { slot: 'armor', defense: 34, levelRequired: 50 } },

  // 전투 전리품
  { id: 'jelly', name: '끈적한 젤리', icon: '🍮', sellPrice: 3 },
  { id: 'leather', name: '가죽', icon: '🟫', sellPrice: 5 },
  { id: 'dried_meat', name: '말린 고기', icon: '🍖', sellPrice: 4, food: { heal: 15 } },
  { id: 'magic_stone', name: '마정석', icon: '🔮', sellPrice: 30 },
  { id: 'wyvern_scale', name: '와이번 비늘', icon: '🐉', sellPrice: 90 },

  // 던전 보상 (미스릴 이후 티어 제작 관문)
  { id: 'mithril_core', name: '미스릴 강화석', icon: '✨', sellPrice: 200 },

  // 낚시 산출물
  { id: 'raw_shrimp', name: '생새우', icon: '🦐', sellPrice: 1 },
  { id: 'raw_herring', name: '생청어', icon: '🐟', sellPrice: 4 },
  { id: 'raw_salmon', name: '생연어', icon: '🐟', sellPrice: 10 },
  { id: 'raw_tuna', name: '생참치', icon: '🐟', sellPrice: 18 },
  { id: 'raw_swordfish', name: '생황새치', icon: '🗡️', sellPrice: 30 },
  { id: 'raw_shark', name: '생상어', icon: '🦈', sellPrice: 45 },

  // 요리 산출물 (말린 고기 15보다 위 — 요리할 이유)
  { id: 'cooked_shrimp', name: '새우구이', icon: '🍤', sellPrice: 3, food: { heal: 20 } },
  { id: 'cooked_herring', name: '청어구이', icon: '🍢', sellPrice: 8, food: { heal: 30 } },
  { id: 'cooked_salmon', name: '연어구이', icon: '🍣', sellPrice: 18, food: { heal: 50 } },
  { id: 'cooked_tuna', name: '참치구이', icon: '🍱', sellPrice: 30, food: { heal: 75 } },
  { id: 'cooked_swordfish', name: '황새치구이', icon: '🍖', sellPrice: 48, food: { heal: 105 } },
  { id: 'cooked_shark', name: '상어구이', icon: '🍗', sellPrice: 70, food: { heal: 140 } },

  // 연금술 재료 (약초는 벌목·채광 부산물)
  { id: 'herb', name: '약초', icon: '🌿', sellPrice: 4 },

  // 물약 — 채집 (사이클 시간 단축)
  { id: 'potion_woodcutting', name: '벌목 물약', icon: '🧪', sellPrice: 12, potion: { category: 'gathering', durationMs: 30 * 60 * 1000, effect: { cycleTime: { skillId: 'woodcutting', multiplier: 0.85 } } } },
  { id: 'potion_mining', name: '채광 물약', icon: '🧪', sellPrice: 16, potion: { category: 'gathering', durationMs: 30 * 60 * 1000, effect: { cycleTime: { skillId: 'mining', multiplier: 0.85 } } } },
  { id: 'potion_fishing', name: '낚시 물약', icon: '🧪', sellPrice: 20, potion: { category: 'gathering', durationMs: 30 * 60 * 1000, effect: { cycleTime: { skillId: 'fishing', multiplier: 0.85 } } } },

  // 물약 — 전투 (스탯 배율)
  { id: 'potion_attack', name: '공격 물약', icon: '⚗️', sellPrice: 35, potion: { category: 'combat', durationMs: 30 * 60 * 1000, effect: { attack: 1.15 } } },
  { id: 'potion_defense', name: '철벽 물약', icon: '⚗️', sellPrice: 45, potion: { category: 'combat', durationMs: 30 * 60 * 1000, effect: { defense: 1.25 } } },
  { id: 'potion_berserk', name: '광전사 물약', icon: '🍷', sellPrice: 80, potion: { category: 'combat', durationMs: 30 * 60 * 1000, effect: { attack: 1.1, defense: 1.1 } } },
];

export const ITEMS: ReadonlyMap<ItemId, ItemDef> = new Map(list.map((i) => [i.id, i]));

export function getItem(id: ItemId): ItemDef {
  const item = ITEMS.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}
