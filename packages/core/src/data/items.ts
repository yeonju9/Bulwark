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

  // 장비 (전투 도입 전까지는 판매/도감용)
  { id: 'copper_sword', name: '구리 검', icon: '🗡️', sellPrice: 25 },
  { id: 'iron_sword', name: '철 검', icon: '⚔️', sellPrice: 80 },
  { id: 'mithril_sword', name: '미스릴 검', icon: '🔱', sellPrice: 240 },
];

export const ITEMS: ReadonlyMap<ItemId, ItemDef> = new Map(list.map((i) => [i.id, i]));

export function getItem(id: ItemId): ItemDef {
  const item = ITEMS.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}
