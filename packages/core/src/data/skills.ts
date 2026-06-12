import { HUNT_ACTIONS } from './monsters';
import type { ActionDef, ActionId, SkillDef, SkillId } from '../types';

export const SKILLS: SkillDef[] = [
  { id: 'woodcutting', name: '벌목', icon: '🌲', description: '나무를 베어 통나무를 얻습니다. 가끔 약초를 발견합니다.' },
  { id: 'mining', name: '채광', icon: '⛏️', description: '광석을 캐냅니다. 가끔 약초를 발견합니다.' },
  { id: 'fishing', name: '낚시', icon: '🎣', description: '물고기를 낚습니다. 요리의 재료가 됩니다.' },
  { id: 'smithing', name: '대장기술', icon: '🔨', description: '광석을 제련하고 장비를 만듭니다.' },
  { id: 'cooking', name: '요리', icon: '🍳', description: '물고기를 요리해 전투용 음식을 만듭니다.' },
  { id: 'alchemy', name: '연금술', icon: '⚗️', description: '약초와 마정석으로 물약을 빚습니다.' },
  { id: 'attack', name: '공격', icon: '⚔️', description: '몬스터를 사냥해 전투 경험을 쌓습니다.' },
  { id: 'hitpoints', name: '체력', icon: '❤️', description: '피해를 견디며 단련됩니다. 최대 HP가 늘어납니다.' },
];

export const COMBAT_SKILL_IDS: ReadonlyArray<SkillId> = ['attack', 'hitpoints'];

/** 약초 부산물 (벌목·채광 공통) */
const HERB_BYPRODUCT = [{ itemId: 'herb', qty: 1, chance: 0.12 }];

const gatheringAndCrafting: ActionDef[] = [
  // 벌목
  { id: 'wc_normal', skillId: 'woodcutting', name: '일반 나무', icon: '🌳', levelRequired: 1, durationMs: 3000, xp: 10, outputs: [{ itemId: 'normal_log', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'wc_oak', skillId: 'woodcutting', name: '참나무', icon: '🌳', levelRequired: 10, durationMs: 4000, xp: 25, outputs: [{ itemId: 'oak_log', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'wc_maple', skillId: 'woodcutting', name: '단풍나무', icon: '🍁', levelRequired: 25, durationMs: 5000, xp: 45, outputs: [{ itemId: 'maple_log', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'wc_yew', skillId: 'woodcutting', name: '주목', icon: '🌲', levelRequired: 40, durationMs: 6000, xp: 80, outputs: [{ itemId: 'yew_log', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'wc_magic', skillId: 'woodcutting', name: '마법나무', icon: '🪄', levelRequired: 55, durationMs: 7000, xp: 130, outputs: [{ itemId: 'magic_log', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'wc_ancient', skillId: 'woodcutting', name: '고대나무', icon: '🌳', levelRequired: 70, durationMs: 8000, xp: 210, outputs: [{ itemId: 'ancient_log', qty: 1 }], byproducts: HERB_BYPRODUCT },

  // 채광
  { id: 'mi_copper', skillId: 'mining', name: '구리 광맥', icon: '🪨', levelRequired: 1, durationMs: 3000, xp: 12, outputs: [{ itemId: 'copper_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'mi_iron', skillId: 'mining', name: '철 광맥', icon: '🪨', levelRequired: 10, durationMs: 4500, xp: 30, outputs: [{ itemId: 'iron_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'mi_silver', skillId: 'mining', name: '은 광맥', icon: '🪨', levelRequired: 20, durationMs: 5000, xp: 42, outputs: [{ itemId: 'silver_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'mi_mithril', skillId: 'mining', name: '미스릴 광맥', icon: '💎', levelRequired: 30, durationMs: 6000, xp: 65, outputs: [{ itemId: 'mithril_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'mi_adamantite', skillId: 'mining', name: '아다만타이트 광맥', icon: '🟩', levelRequired: 45, durationMs: 7000, xp: 110, outputs: [{ itemId: 'adamantite_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },
  { id: 'mi_orichalcum', skillId: 'mining', name: '오리할콘 광맥', icon: '🟨', levelRequired: 60, durationMs: 8000, xp: 170, outputs: [{ itemId: 'orichalcum_ore', qty: 1 }], byproducts: HERB_BYPRODUCT },

  // 낚시
  { id: 'fi_shrimp', skillId: 'fishing', name: '새우 낚시', icon: '🦐', levelRequired: 1, durationMs: 3000, xp: 10, outputs: [{ itemId: 'raw_shrimp', qty: 1 }] },
  { id: 'fi_herring', skillId: 'fishing', name: '청어 낚시', icon: '🐟', levelRequired: 10, durationMs: 4000, xp: 25, outputs: [{ itemId: 'raw_herring', qty: 1 }] },
  { id: 'fi_salmon', skillId: 'fishing', name: '연어 낚시', icon: '🐟', levelRequired: 22, durationMs: 5000, xp: 45, outputs: [{ itemId: 'raw_salmon', qty: 1 }] },
  { id: 'fi_tuna', skillId: 'fishing', name: '참치 낚시', icon: '🐟', levelRequired: 35, durationMs: 5500, xp: 70, outputs: [{ itemId: 'raw_tuna', qty: 1 }] },
  { id: 'fi_swordfish', skillId: 'fishing', name: '황새치 낚시', icon: '🗡️', levelRequired: 50, durationMs: 6500, xp: 110, outputs: [{ itemId: 'raw_swordfish', qty: 1 }] },
  { id: 'fi_shark', skillId: 'fishing', name: '상어 낚시', icon: '🦈', levelRequired: 65, durationMs: 7500, xp: 160, outputs: [{ itemId: 'raw_shark', qty: 1 }] },

  // 요리 (요리 실패 메커니즘 없음 — 결정성·단순화)
  { id: 'co_shrimp', skillId: 'cooking', name: '새우 굽기', icon: '🍤', levelRequired: 1, durationMs: 2000, xp: 8, inputs: [{ itemId: 'raw_shrimp', qty: 1 }], outputs: [{ itemId: 'cooked_shrimp', qty: 1 }] },
  { id: 'co_herring', skillId: 'cooking', name: '청어 굽기', icon: '🍢', levelRequired: 10, durationMs: 2500, xp: 20, inputs: [{ itemId: 'raw_herring', qty: 1 }], outputs: [{ itemId: 'cooked_herring', qty: 1 }] },
  { id: 'co_salmon', skillId: 'cooking', name: '연어 굽기', icon: '🍣', levelRequired: 22, durationMs: 3000, xp: 35, inputs: [{ itemId: 'raw_salmon', qty: 1 }], outputs: [{ itemId: 'cooked_salmon', qty: 1 }] },
  { id: 'co_tuna', skillId: 'cooking', name: '참치 굽기', icon: '🍱', levelRequired: 35, durationMs: 3500, xp: 55, inputs: [{ itemId: 'raw_tuna', qty: 1 }], outputs: [{ itemId: 'cooked_tuna', qty: 1 }] },
  { id: 'co_swordfish', skillId: 'cooking', name: '황새치 굽기', icon: '🍖', levelRequired: 50, durationMs: 4000, xp: 85, inputs: [{ itemId: 'raw_swordfish', qty: 1 }], outputs: [{ itemId: 'cooked_swordfish', qty: 1 }] },
  { id: 'co_shark', skillId: 'cooking', name: '상어 굽기', icon: '🍗', levelRequired: 65, durationMs: 4500, xp: 120, inputs: [{ itemId: 'raw_shark', qty: 1 }], outputs: [{ itemId: 'cooked_shark', qty: 1 }] },

  // 연금술 — 채집 물약 (젤리가 점성 베이스: 슬라임 전리품의 소비처)
  { id: 'al_woodcutting', skillId: 'alchemy', name: '벌목 물약 조제', icon: '🧪', levelRequired: 1, durationMs: 3000, xp: 12, inputs: [{ itemId: 'herb', qty: 2 }, { itemId: 'jelly', qty: 1 }], outputs: [{ itemId: 'potion_woodcutting', qty: 1 }] },
  { id: 'al_mining', skillId: 'alchemy', name: '채광 물약 조제', icon: '🧪', levelRequired: 8, durationMs: 3000, xp: 22, inputs: [{ itemId: 'herb', qty: 2 }, { itemId: 'jelly', qty: 1 }], outputs: [{ itemId: 'potion_mining', qty: 1 }] },
  { id: 'al_fishing', skillId: 'alchemy', name: '낚시 물약 조제', icon: '🧪', levelRequired: 16, durationMs: 3500, xp: 35, inputs: [{ itemId: 'herb', qty: 2 }, { itemId: 'jelly', qty: 1 }], outputs: [{ itemId: 'potion_fishing', qty: 1 }] },

  // 연금술 — 전투 물약 (마정석: 전투 전리품의 소비처)
  { id: 'al_attack', skillId: 'alchemy', name: '공격 물약 조제', icon: '⚗️', levelRequired: 25, durationMs: 4000, xp: 55, inputs: [{ itemId: 'herb', qty: 2 }, { itemId: 'magic_stone', qty: 1 }], outputs: [{ itemId: 'potion_attack', qty: 1 }] },
  { id: 'al_defense', skillId: 'alchemy', name: '철벽 물약 조제', icon: '⚗️', levelRequired: 34, durationMs: 4000, xp: 75, inputs: [{ itemId: 'herb', qty: 3 }, { itemId: 'magic_stone', qty: 1 }], outputs: [{ itemId: 'potion_defense', qty: 1 }] },
  { id: 'al_berserk', skillId: 'alchemy', name: '광전사 물약 조제', icon: '🍷', levelRequired: 45, durationMs: 5000, xp: 110, inputs: [{ itemId: 'herb', qty: 4 }, { itemId: 'magic_stone', qty: 2 }], outputs: [{ itemId: 'potion_berserk', qty: 1 }] },

  // 대장기술 — 제련
  { id: 'sm_copper_bar', skillId: 'smithing', name: '구리 제련', icon: '🟧', levelRequired: 1, durationMs: 2000, xp: 8, inputs: [{ itemId: 'copper_ore', qty: 1 }], outputs: [{ itemId: 'copper_bar', qty: 1 }] },
  { id: 'sm_iron_bar', skillId: 'smithing', name: '철 제련', icon: '⬜', levelRequired: 10, durationMs: 3000, xp: 20, inputs: [{ itemId: 'iron_ore', qty: 1 }], outputs: [{ itemId: 'iron_bar', qty: 1 }] },
  { id: 'sm_silver_bar', skillId: 'smithing', name: '은 제련', icon: '⬜', levelRequired: 20, durationMs: 3500, xp: 30, inputs: [{ itemId: 'silver_ore', qty: 1 }], outputs: [{ itemId: 'silver_bar', qty: 1 }] },
  { id: 'sm_mithril_bar', skillId: 'smithing', name: '미스릴 제련', icon: '🟦', levelRequired: 30, durationMs: 4000, xp: 45, inputs: [{ itemId: 'mithril_ore', qty: 1 }], outputs: [{ itemId: 'mithril_bar', qty: 1 }] },
  { id: 'sm_adamantite_bar', skillId: 'smithing', name: '아다만타이트 제련', icon: '🟩', levelRequired: 45, durationMs: 4500, xp: 70, inputs: [{ itemId: 'adamantite_ore', qty: 1 }], outputs: [{ itemId: 'adamantite_bar', qty: 1 }] },
  { id: 'sm_orichalcum_bar', skillId: 'smithing', name: '오리할콘 제련', icon: '🟨', levelRequired: 60, durationMs: 5000, xp: 100, inputs: [{ itemId: 'orichalcum_ore', qty: 1 }], outputs: [{ itemId: 'orichalcum_bar', qty: 1 }] },

  // 대장기술 — 무기 제작
  { id: 'sm_copper_sword', skillId: 'smithing', name: '구리 검 제작', icon: '🗡️', levelRequired: 5, durationMs: 4000, xp: 20, inputs: [{ itemId: 'copper_bar', qty: 2 }, { itemId: 'normal_log', qty: 1 }], outputs: [{ itemId: 'copper_sword', qty: 1 }] },
  { id: 'sm_iron_sword', skillId: 'smithing', name: '철 검 제작', icon: '⚔️', levelRequired: 15, durationMs: 5000, xp: 50, inputs: [{ itemId: 'iron_bar', qty: 2 }, { itemId: 'oak_log', qty: 1 }], outputs: [{ itemId: 'iron_sword', qty: 1 }] },
  { id: 'sm_silver_sword', skillId: 'smithing', name: '은 검 제작', icon: '🤺', levelRequired: 22, durationMs: 5500, xp: 70, inputs: [{ itemId: 'silver_bar', qty: 2 }, { itemId: 'oak_log', qty: 1 }], outputs: [{ itemId: 'silver_sword', qty: 1 }] },
  { id: 'sm_mithril_sword', skillId: 'smithing', name: '미스릴 검 제작', icon: '🔱', levelRequired: 35, durationMs: 6000, xp: 110, inputs: [{ itemId: 'mithril_bar', qty: 2 }, { itemId: 'maple_log', qty: 1 }, { itemId: 'mithril_core', qty: 1 }], outputs: [{ itemId: 'mithril_sword', qty: 1 }] },
  { id: 'sm_adamantite_sword', skillId: 'smithing', name: '아다만타이트 검 제작', icon: '🗡️', levelRequired: 48, durationMs: 6500, xp: 160, inputs: [{ itemId: 'adamantite_bar', qty: 2 }, { itemId: 'yew_log', qty: 1 }, { itemId: 'mithril_core', qty: 1 }], outputs: [{ itemId: 'adamantite_sword', qty: 1 }] },
  { id: 'sm_orichalcum_sword', skillId: 'smithing', name: '오리할콘 검 제작', icon: '⚜️', levelRequired: 62, durationMs: 7000, xp: 230, inputs: [{ itemId: 'orichalcum_bar', qty: 2 }, { itemId: 'magic_log', qty: 1 }, { itemId: 'wyvern_scale', qty: 2 }], outputs: [{ itemId: 'orichalcum_sword', qty: 1 }] },

  // 대장기술 — 방어구 제작 (가죽은 전투 전리품 → 전투가 채집·제작에 되먹임)
  { id: 'sm_leather_armor', skillId: 'smithing', name: '가죽 갑옷 제작', icon: '🦺', levelRequired: 8, durationMs: 4000, xp: 18, inputs: [{ itemId: 'leather', qty: 5 }], outputs: [{ itemId: 'leather_armor', qty: 1 }] },
  { id: 'sm_iron_armor', skillId: 'smithing', name: '철 갑옷 제작', icon: '🛡️', levelRequired: 18, durationMs: 5500, xp: 55, inputs: [{ itemId: 'iron_bar', qty: 3 }, { itemId: 'leather', qty: 2 }], outputs: [{ itemId: 'iron_armor', qty: 1 }] },
  { id: 'sm_mithril_armor', skillId: 'smithing', name: '미스릴 갑옷 제작', icon: '🎽', levelRequired: 38, durationMs: 6500, xp: 120, inputs: [{ itemId: 'mithril_bar', qty: 3 }, { itemId: 'leather', qty: 4 }, { itemId: 'mithril_core', qty: 1 }], outputs: [{ itemId: 'mithril_armor', qty: 1 }] },
  { id: 'sm_adamantite_armor', skillId: 'smithing', name: '아다만타이트 갑옷 제작', icon: '🥋', levelRequired: 52, durationMs: 7000, xp: 180, inputs: [{ itemId: 'adamantite_bar', qty: 3 }, { itemId: 'leather', qty: 4 }, { itemId: 'mithril_core', qty: 1 }], outputs: [{ itemId: 'adamantite_armor', qty: 1 }] },
  { id: 'sm_orichalcum_armor', skillId: 'smithing', name: '오리할콘 갑옷 제작', icon: '👘', levelRequired: 66, durationMs: 7500, xp: 260, inputs: [{ itemId: 'orichalcum_bar', qty: 3 }, { itemId: 'wyvern_scale', qty: 3 }, { itemId: 'ancient_log', qty: 1 }], outputs: [{ itemId: 'orichalcum_armor', qty: 1 }] },
];

const list: ActionDef[] = [...gatheringAndCrafting, ...HUNT_ACTIONS];

export const ACTIONS: ReadonlyMap<ActionId, ActionDef> = new Map(list.map((a) => [a.id, a]));

export function getAction(id: ActionId): ActionDef {
  const action = ACTIONS.get(id);
  if (!action) throw new Error(`Unknown action: ${id}`);
  return action;
}

export function actionsForSkill(skillId: SkillId): ActionDef[] {
  return list.filter((a) => a.skillId === skillId);
}

export function getSkill(id: SkillId): SkillDef {
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}
