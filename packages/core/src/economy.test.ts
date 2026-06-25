import { describe, expect, it } from 'vitest';
import { effectiveCycleMs, combatBuffMultipliers } from './buffs';
import { computeVillageStats } from './combat/village';
import { buyUpgrade, drinkPotion, setCombatFood, startAction } from './commands';
import { ITEMS, getItem } from './data/items';
import { ACTIONS, getAction } from './data/skills';
import { DUNGEONS, MONSTERS } from './data/monsters';
import { UPGRADES } from './data/upgrades';
import { simulate } from './simulate';
import { createInitialState, migrateSave, SAVE_VERSION } from './state';
import { xpForLevel } from './xp';
import type { GameState, SkillId, SkillState } from './types';

const T0 = 1_000_000;
const MIN30 = 30 * 60 * 1000;

function skillsWith(patch: Partial<Record<SkillId, SkillState>>): Record<SkillId, SkillState> {
  return { ...createInitialState(T0).skills, ...patch };
}

function stateWith(patch?: Partial<GameState>): GameState {
  return { ...createInitialState(T0), ...patch };
}

describe('물약과 버프', () => {
  it('물약을 마시면 소모되고 버프가 생기며, 같은 카테고리는 교체된다', () => {
    const s0 = stateWith({ inventory: { potion_woodcutting: 2, potion_mining: 1 } });
    const s1 = drinkPotion(s0, 'potion_woodcutting', T0).state;
    expect(s1.inventory['potion_woodcutting']).toBe(1);
    expect(s1.buffs).toEqual([
      { itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: T0 + MIN30 },
    ]);

    // 같은 카테고리(채집) → 교체
    const s2 = drinkPotion(s1, 'potion_mining', T0 + 1000).state;
    expect(s2.buffs).toHaveLength(1);
    expect(s2.buffs[0].itemId).toBe('potion_mining');
  });

  it('물약이 아니거나 없는 아이템은 거부한다', () => {
    expect(drinkPotion(stateWith(), 'normal_log', T0).error).toBe('not-potion');
    expect(drinkPotion(stateWith(), 'potion_attack', T0).error).toBe('not-enough-items');
  });

  it('채집 물약은 해당 스킬의 사이클만 단축한다', () => {
    const buffed = stateWith({
      buffs: [{ itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: T0 + MIN30 }],
    });
    expect(effectiveCycleMs(getAction('wc_normal'), buffed)).toBe(2550); // 3000 × 0.85
    expect(effectiveCycleMs(getAction('mi_copper'), buffed)).toBe(3000); // 영향 없음
  });

  it('전투 물약은 computeVillageStats에 곱연산으로 반영된다', () => {
    const base = computeVillageStats(stateWith());
    const buffed = computeVillageStats(
      stateWith({
        buffs: [{ itemId: 'potion_attack', category: 'combat', expiresAtMs: T0 + MIN30 }],
      }),
    );
    expect(buffed.attackPower).toBe(Math.round(base.attackPower * 1.15));
    expect(combatBuffMultipliers(stateWith()).attack).toBe(1);
  });

  it('버프는 만료 시각이 지나면 simulate에서 제거된다', () => {
    const s0 = stateWith({
      buffs: [{ itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: T0 + 1000 }],
    });
    const { state } = simulate(s0, T0 + 2000);
    expect(state.buffs).toEqual([]);
  });

  it('오프라인 중 버프 만료: 만료 시각까지만 효과가 적용된다 (경계 분할 정산)', () => {
    // 벌목 물약: 사이클 3000 → 2550. 버프가 102초(2550×40)에 만료되도록 설정.
    const expiresAt = T0 + 40 * 2550;
    const base = stateWith({
      buffs: [{ itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: expiresAt }],
    });
    const s0 = startAction(base, 'wc_normal').state;

    // 버프 구간 40사이클 + 일반 구간 (60초 = 20사이클)
    const { state } = simulate(s0, expiresAt + 60_000);
    expect(state.inventory['normal_log']).toBe(60);
    expect(state.buffs).toEqual([]);
  });

  it('버프 만료를 가로지르는 실시간 틱 누적과 오프라인 일괄 정산이 완전히 같다', () => {
    const base = stateWith({
      // 마을 HP는 정수이며 이 구간엔 웨이브가 발생하지 않아(주기 3분) 채집 정산만 비교된다
      buffs: [{ itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: T0 + 30_000 }],
    });
    const s0 = startAction(base, 'wc_normal').state;
    const end = T0 + 90_000;

    const offline = simulate(s0, end).state;

    let online = s0;
    for (let t = T0 + 777; t < end; t += 777) {
      online = simulate(online, t).state;
    }
    online = simulate(online, end).state;

    expect(online).toEqual(offline);
  });
});

describe('약초 부산물', () => {
  it('벌목 사이클마다 시드 난수로 약초가 나오며, 같은 입력이면 항상 같다', () => {
    const s0 = startAction(stateWith(), 'wc_normal').state;
    const a = simulate(s0, T0 + 300_000).state; // 100사이클
    const b = simulate(s0, T0 + 300_000).state;
    expect(a.inventory['herb']).toBeGreaterThan(0);
    expect(a.inventory).toEqual(b.inventory);
    expect(a.actionCycles['wc_normal']).toBe(100);
  });

  it('부산물도 틱 누적과 오프라인 정산이 같은 결과를 낸다', () => {
    const s0 = startAction(stateWith(), 'mi_copper').state;
    const end = T0 + 120_000;

    const offline = simulate(s0, end).state;
    let online = s0;
    for (let t = T0 + 333; t < end; t += 333) {
      online = simulate(online, t).state;
    }
    online = simulate(online, end).state;

    expect(online).toEqual(offline);
  });
});

describe('상점 — 도구 업그레이드', () => {
  it('구매하면 골드가 차감되고 사이클이 5%씩 빨라진다', () => {
    const s0 = stateWith({ gold: 1000 });
    const { state, error } = buyUpgrade(s0, 'woodcutting');
    expect(error).toBeUndefined();
    expect(state.gold).toBe(200); // 1단계 800골드
    expect(state.upgrades.woodcutting).toBe(1);
    expect(effectiveCycleMs(getAction('wc_normal'), state)).toBe(2850); // 3000 × 0.95
  });

  it('골드 부족·최대 단계·업그레이드 없는 스킬은 거부한다', () => {
    expect(buyUpgrade(stateWith({ gold: 10 }), 'woodcutting').error).toBe('not-enough-gold');
    expect(buyUpgrade(stateWith(), 'smithing').error).toBe('unknown-upgrade');

    const maxed = stateWith({ gold: 1e9, upgrades: { mining: 5 } });
    expect(buyUpgrade(maxed, 'mining').error).toBe('max-stage');
  });

  it('업그레이드와 채집 물약은 곱연산으로 중첩된다', () => {
    const s0 = stateWith({
      upgrades: { woodcutting: 2 },
      buffs: [{ itemId: 'potion_woodcutting', category: 'gathering', expiresAtMs: T0 + MIN30 }],
    });
    // 3000 × 0.95² × 0.85 = 2301.375 → 2301
    expect(effectiveCycleMs(getAction('wc_normal'), s0)).toBe(2301);
  });
});

describe('낚시 → 요리 파이프라인', () => {
  it('낚은 물고기를 요리해 음식으로 만들고, 사냥 음식 슬롯에 지정할 수 있다', () => {
    const fishing = startAction(stateWith(), 'fi_shrimp').state;
    const fished = simulate(fishing, T0 + 30_000).state; // 10사이클
    expect(fished.inventory['raw_shrimp']).toBe(10);

    const cooking = startAction(fished, 'co_shrimp').state; // 같은 슬롯 교체 (1슬롯)
    const cooked = simulate(cooking, T0 + 60_000).state;
    expect(cooked.inventory['cooked_shrimp']).toBe(10);
    expect(cooked.inventory['raw_shrimp']).toBeUndefined();

    expect(setCombatFood(cooked, 'cooked_shrimp').state.combatFood).toBe('cooked_shrimp');
    expect(getItem('cooked_shrimp').food!.heal).toBeGreaterThan(getItem('dried_meat').food!.heal);
  });
});

describe('세이브 마이그레이션 v3→v4', () => {
  it('신규 스킬·버프·업그레이드 필드를 기본값으로 채운다', () => {
    const v3 = {
      version: 3,
      createdAt: T0,
      lastTickAt: T0,
      gold: 500,
      skills: {
        woodcutting: { xp: 1000 }, mining: { xp: 0 }, smithing: { xp: 0 },
        attack: { xp: 300 }, hitpoints: { xp: xpForLevel(12) },
      },
      inventory: { mithril_core: 1 },
      activeActions: [],
      equipment: { weapon: 'iron_sword', armor: null },
      hp: 80,
      combatFood: 'dried_meat',
      monsterKills: { slime: 50 },
      dungeonCooldowns: {},
    };
    const migrated = migrateSave(v3);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect(migrated!.skills.fishing).toEqual({ xp: 0 });
    expect(migrated!.skills.cooking).toEqual({ xp: 0 });
    expect(migrated!.skills.alchemy).toEqual({ xp: 0 });
    expect(migrated!.buffs).toEqual([]);
    expect(migrated!.upgrades).toEqual({});
    expect(migrated!.actionCycles).toEqual({});
    expect(migrated!.skills.woodcutting.xp).toBe(1000); // 기존 진행 유지
    expect(migrated!.equipment.weapon).toBe('iron_sword');
  });
});

describe('경제 순환 검증 (Phase 3 DoD: 팔기만 하는 아이템 없음)', () => {
  it('모든 아이템에 판매 외의 소비처가 있다', () => {
    const consumed = new Set<string>();
    for (const action of ACTIONS.values()) {
      for (const input of action.inputs ?? []) consumed.add(input.itemId);
    }
    const missing: string[] = [];
    for (const item of ITEMS.values()) {
      const hasUse =
        consumed.has(item.id) || item.equip !== undefined ||
        item.food !== undefined || item.potion !== undefined;
      if (!hasUse) missing.push(item.id);
    }
    expect(missing).toEqual([]);
  });

  it('액션·몬스터·던전·업그레이드가 참조하는 데이터가 모두 존재한다', () => {
    for (const action of ACTIONS.values()) {
      for (const stack of [...(action.inputs ?? []), ...action.outputs]) {
        expect(ITEMS.has(stack.itemId), `${action.id} → ${stack.itemId}`).toBe(true);
      }
      for (const entry of action.byproducts ?? []) {
        expect(ITEMS.has(entry.itemId), `${action.id} → ${entry.itemId}`).toBe(true);
      }
      if (action.combat) expect(MONSTERS.has(action.combat.monsterId)).toBe(true);
    }
    for (const monster of MONSTERS.values()) {
      for (const entry of monster.lootTable) {
        expect(ITEMS.has(entry.itemId), `${monster.id} → ${entry.itemId}`).toBe(true);
      }
    }
    for (const dungeon of DUNGEONS.values()) {
      for (const id of dungeon.monsters) expect(MONSTERS.has(id)).toBe(true);
      for (const entry of [...dungeon.firstRewards, ...dungeon.repeatRewards]) {
        expect(ITEMS.has(entry.itemId)).toBe(true);
      }
    }
    for (const upgrade of UPGRADES) {
      expect(upgrade.stages.length).toBeGreaterThan(0);
    }
  });

  it('낚시+요리 등 슬롯 2개 조합이 동작한다 (생산 → 소비 동시 가동)', () => {
    // 총 레벨을 2슬롯 기준 위로
    const s0 = stateWith({
      skills: skillsWith({ woodcutting: { xp: xpForLevel(30) } }),
      inventory: { raw_shrimp: 5 },
    });
    const s1 = startAction(s0, 'fi_shrimp').state;
    const s2 = startAction(s1, 'co_shrimp').state;
    expect(s2.activeActions).toHaveLength(2);

    const { state } = simulate(s2, T0 + 60_000);
    // 낚시 20사이클(3초) 공급 + 시작 재고 5 → 요리는 2초 사이클이라 공급에 묶임
    expect(state.inventory['cooked_shrimp']).toBeGreaterThanOrEqual(25 - 1);
    expect(state.activeActions).toHaveLength(2); // 같은 구간 안 공급으로 계속 가동
  });

  it('재료가 0이어도 공급 작업이 활성이면 소비 작업을 시작할 수 있다', () => {
    const s0 = stateWith({ skills: skillsWith({ woodcutting: { xp: xpForLevel(30) } }) });

    // 낚시 없이 요리 시작 → 거부
    expect(startAction(s0, 'co_shrimp').error).toBe('missing-materials');

    // 낚시 가동 중이면 생새우 0개여도 요리 시작 허용 (재료 도착까지 대기)
    const fishing = startAction(s0, 'fi_shrimp').state;
    const { state, error } = startAction(fishing, 'co_shrimp');
    expect(error).toBeUndefined();
    expect(state.activeActions).toHaveLength(2);

    // 1분 뒤: 낚시 20마리 공급 → 요리가 전부 소화
    const settled = simulate(state, T0 + 60_000).state;
    expect(settled.inventory['cooked_shrimp']).toBeGreaterThanOrEqual(19);
    expect(settled.activeActions).toHaveLength(2);
  });
});
