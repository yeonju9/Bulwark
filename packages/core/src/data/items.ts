import type { ItemDef, ItemId } from '../types';

const list: ItemDef[] = [
  // 벌목 산출물
  { id: 'normal_log', name: '통나무', icon: '🪵', sellPrice: 1 },
  { id: 'oak_log', name: '참나무 통나무', icon: '🪵', sellPrice: 5 },
  { id: 'maple_log', name: '단풍나무 통나무', icon: '🪵', sellPrice: 15 },
  { id: 'yew_log', name: '주목 통나무', icon: '🪵', sellPrice: 40 },

  // 채광 산출물
  { id: 'copper_ore', name: '구리 광석', icon: '🪨', sellPrice: 2 },
  { id: 'iron_ore', name: '철 광석', icon: '🪨', sellPrice: 8 },
  { id: 'silver_ore', name: '은 광석', icon: '🪨', sellPrice: 15 },
  { id: 'mithril_ore', name: '미스릴 광석', icon: '💎', sellPrice: 25 },

  // 제련 산출물
  { id: 'copper_bar', name: '구리 주괴', icon: '🟧', sellPrice: 6 },
  { id: 'iron_bar', name: '철 주괴', icon: '⬜', sellPrice: 20 },
  { id: 'silver_bar', name: '은 주괴', icon: '⬜', sellPrice: 35 },
  { id: 'mithril_bar', name: '미스릴 주괴', icon: '🟦', sellPrice: 60 },

  // 무기
  { id: 'copper_sword', name: '구리 검', icon: '🗡️', sellPrice: 25, equip: { slot: 'weapon', attack: 4, levelRequired: 1 } },
  { id: 'iron_sword', name: '철 검', icon: '⚔️', sellPrice: 80, equip: { slot: 'weapon', attack: 10, levelRequired: 10 } },
  { id: 'silver_sword', name: '은 검', icon: '🤺', sellPrice: 150, equip: { slot: 'weapon', attack: 15, levelRequired: 18 } },
  { id: 'mithril_sword', name: '미스릴 검', icon: '🔱', sellPrice: 240, equip: { slot: 'weapon', attack: 24, levelRequired: 30 } },

  // 방어구
  { id: 'leather_armor', name: '가죽 갑옷', icon: '🦺', sellPrice: 40, equip: { slot: 'armor', defense: 4, levelRequired: 1 } },
  { id: 'iron_armor', name: '철 갑옷', icon: '🛡️', sellPrice: 120, equip: { slot: 'armor', defense: 9, levelRequired: 12 } },
  { id: 'mithril_armor', name: '미스릴 갑옷', icon: '🎽', sellPrice: 320, equip: { slot: 'armor', defense: 16, levelRequired: 28 } },

  // 전투 전리품
  { id: 'jelly', name: '끈적한 젤리', icon: '🫧', sellPrice: 3 },
  { id: 'leather', name: '가죽', icon: '🟫', sellPrice: 5 },
  { id: 'dried_meat', name: '말린 고기', icon: '🍖', sellPrice: 4, food: { heal: 15 } },
  { id: 'magic_stone', name: '마정석', icon: '🔮', sellPrice: 30 },

  // 던전 보상 (미스릴 티어 제작 관문)
  { id: 'mithril_core', name: '미스릴 강화석', icon: '✨', sellPrice: 200 },
];

export const ITEMS: ReadonlyMap<ItemId, ItemDef> = new Map(list.map((i) => [i.id, i]));

export function getItem(id: ItemId): ItemDef {
  const item = ITEMS.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}
