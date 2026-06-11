import type { ActionDef, ActionId, SkillDef, SkillId } from '../types';

export const SKILLS: SkillDef[] = [
  { id: 'woodcutting', name: '벌목', icon: '🌲', description: '나무를 베어 통나무를 얻습니다.' },
  { id: 'mining', name: '채광', icon: '⛏️', description: '광석을 캐냅니다.' },
  { id: 'smithing', name: '대장기술', icon: '🔨', description: '광석을 제련하고 장비를 만듭니다.' },
];

const list: ActionDef[] = [
  // 벌목
  { id: 'wc_normal', skillId: 'woodcutting', name: '일반 나무', icon: '🌳', levelRequired: 1, durationMs: 3000, xp: 10, outputs: [{ itemId: 'normal_log', qty: 1 }] },
  { id: 'wc_oak', skillId: 'woodcutting', name: '참나무', icon: '🌳', levelRequired: 10, durationMs: 4000, xp: 25, outputs: [{ itemId: 'oak_log', qty: 1 }] },
  { id: 'wc_maple', skillId: 'woodcutting', name: '단풍나무', icon: '🍁', levelRequired: 25, durationMs: 5000, xp: 45, outputs: [{ itemId: 'maple_log', qty: 1 }] },
  { id: 'wc_yew', skillId: 'woodcutting', name: '주목', icon: '🌲', levelRequired: 40, durationMs: 6000, xp: 80, outputs: [{ itemId: 'yew_log', qty: 1 }] },

  // 채광
  { id: 'mi_copper', skillId: 'mining', name: '구리 광맥', icon: '🪨', levelRequired: 1, durationMs: 3000, xp: 12, outputs: [{ itemId: 'copper_ore', qty: 1 }] },
  { id: 'mi_iron', skillId: 'mining', name: '철 광맥', icon: '🪨', levelRequired: 10, durationMs: 4500, xp: 30, outputs: [{ itemId: 'iron_ore', qty: 1 }] },
  { id: 'mi_silver', skillId: 'mining', name: '은 광맥', icon: '🪨', levelRequired: 20, durationMs: 5000, xp: 42, outputs: [{ itemId: 'silver_ore', qty: 1 }] },
  { id: 'mi_mithril', skillId: 'mining', name: '미스릴 광맥', icon: '💎', levelRequired: 30, durationMs: 6000, xp: 65, outputs: [{ itemId: 'mithril_ore', qty: 1 }] },

  // 대장기술 — 제련
  { id: 'sm_copper_bar', skillId: 'smithing', name: '구리 제련', icon: '🟧', levelRequired: 1, durationMs: 2000, xp: 8, inputs: [{ itemId: 'copper_ore', qty: 1 }], outputs: [{ itemId: 'copper_bar', qty: 1 }] },
  { id: 'sm_iron_bar', skillId: 'smithing', name: '철 제련', icon: '⬜', levelRequired: 10, durationMs: 3000, xp: 20, inputs: [{ itemId: 'iron_ore', qty: 1 }], outputs: [{ itemId: 'iron_bar', qty: 1 }] },
  { id: 'sm_silver_bar', skillId: 'smithing', name: '은 제련', icon: '⬜', levelRequired: 20, durationMs: 3500, xp: 30, inputs: [{ itemId: 'silver_ore', qty: 1 }], outputs: [{ itemId: 'silver_bar', qty: 1 }] },
  { id: 'sm_mithril_bar', skillId: 'smithing', name: '미스릴 제련', icon: '🟦', levelRequired: 30, durationMs: 4000, xp: 45, inputs: [{ itemId: 'mithril_ore', qty: 1 }], outputs: [{ itemId: 'mithril_bar', qty: 1 }] },

  // 대장기술 — 장비 제작
  { id: 'sm_copper_sword', skillId: 'smithing', name: '구리 검 제작', icon: '🗡️', levelRequired: 5, durationMs: 4000, xp: 20, inputs: [{ itemId: 'copper_bar', qty: 2 }, { itemId: 'normal_log', qty: 1 }], outputs: [{ itemId: 'copper_sword', qty: 1 }] },
  { id: 'sm_iron_sword', skillId: 'smithing', name: '철 검 제작', icon: '⚔️', levelRequired: 15, durationMs: 5000, xp: 50, inputs: [{ itemId: 'iron_bar', qty: 2 }, { itemId: 'oak_log', qty: 1 }], outputs: [{ itemId: 'iron_sword', qty: 1 }] },
  { id: 'sm_mithril_sword', skillId: 'smithing', name: '미스릴 검 제작', icon: '🔱', levelRequired: 35, durationMs: 6000, xp: 110, inputs: [{ itemId: 'mithril_bar', qty: 2 }, { itemId: 'maple_log', qty: 1 }], outputs: [{ itemId: 'mithril_sword', qty: 1 }] },
];

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
