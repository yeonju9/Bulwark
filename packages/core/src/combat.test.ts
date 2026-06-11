import { describe, expect, it } from 'vitest';
import { attemptDungeon, DUNGEON_COOLDOWN_MS } from './combat/dungeon';
import { computeStats, damageTakenPerKill, timeToKillMs } from './combat/stats';
import { equipItem, setCombatFood, startAction, unequipItem } from './commands';
import { huntableMonsters } from './data/monsters';
import { simulate } from './simulate';
import { createInitialState, migrateSave, SAVE_VERSION } from './state';
import { xpForLevel } from './xp';
import type { GameState, SkillId, SkillState } from './types';

const T0 = 1_000_000;

function skillsWith(patch: Partial<Record<SkillId, SkillState>>): Record<SkillId, SkillState> {
  return { ...createInitialState(T0).skills, ...patch };
}

function stateWith(patch?: Partial<GameState>): GameState {
  return { ...createInitialState(T0), ...patch };
}

describe('computeStats', () => {
  it('레벨과 장비에서 스탯을 파생한다', () => {
    const naked = computeStats(stateWith());
    expect(naked).toEqual({ attackLevel: 1, hpLevel: 10, maxHp: 100, attackPower: 2, defense: 0 });

    const armed = computeStats(
      stateWith({ equipment: { weapon: 'copper_sword', armor: 'leather_armor' } }),
    );
    expect(armed.attackPower).toBe(6); // 1 + 공격Lv1 + 구리검4
    expect(armed.defense).toBe(4);
  });
});

describe('장비 커맨드', () => {
  it('장착하면 인벤토리에서 빠지고, 기존 장비는 인벤토리로 돌아온다', () => {
    const s0 = stateWith({ inventory: { copper_sword: 1, iron_sword: 1 } });
    const s1 = equipItem(s0, 'copper_sword').state;
    expect(s1.equipment.weapon).toBe('copper_sword');
    expect(s1.inventory['copper_sword']).toBeUndefined();

    // 철 검은 공격 Lv10 필요 → 거부
    expect(equipItem(s1, 'iron_sword').error).toBe('level-too-low');

    const s2 = unequipItem(s1, 'weapon').state;
    expect(s2.equipment.weapon).toBeNull();
    expect(s2.inventory['copper_sword']).toBe(1);
  });

  it('음식 슬롯은 food 아이템만 지정할 수 있다', () => {
    const s0 = stateWith();
    expect(setCombatFood(s0, 'dried_meat').state.combatFood).toBe('dried_meat');
    expect(setCombatFood(s0, 'normal_log').error).toBe('not-food');
  });
});

describe('사냥', () => {
  function huntingState(patch?: Partial<GameState>): GameState {
    const base = stateWith(patch);
    const { state, error } = startAction(base, 'hunt_slime');
    expect(error).toBeUndefined();
    return state;
  }

  it('처치 수만큼 공격·체력 XP와 도감 처치 수가 쌓인다', () => {
    const s0 = huntingState();
    const { state, gains } = simulate(s0, T0 + 60_000);
    const kills = state.monsterKills['slime'] ?? 0;
    expect(kills).toBeGreaterThan(0);
    expect(gains.xp.attack).toBe(8 * kills);
    expect(gains.xp.hitpoints).toBeGreaterThan(0);
    expect(state.hp).toBeLessThan(100);
  });

  it('HP가 버틸 수 없으면 죽기 전에 사냥을 멈춘다 (소프트 페널티)', () => {
    const s0 = huntingState();
    const { state, gains } = simulate(s0, T0 + 3_600_000); // 1시간 — 시간상 처치 수 ≫ 유지 가능 수
    expect(gains.stopped).toEqual([{ actionId: 'hunt_slime', reason: 'low-hp' }]);
    expect(state.activeActions).toHaveLength(0);
    expect(state.hp).toBeGreaterThanOrEqual(1);
  });

  it('음식이 있으면 자동 섭취하며 더 오래 버틴다', () => {
    const noFood = simulate(huntingState(), T0 + 3_600_000);
    const withFood = simulate(
      huntingState({ inventory: { dried_meat: 20 }, combatFood: 'dried_meat' }),
      T0 + 3_600_000,
    );
    const killsNoFood = noFood.state.monsterKills['slime'] ?? 0;
    const killsWithFood = withFood.state.monsterKills['slime'] ?? 0;
    expect(killsWithFood).toBeGreaterThan(killsNoFood);
    expect(withFood.gains.itemsConsumed['dried_meat']).toBeGreaterThan(0);
  });

  it('실시간 틱 누적과 오프라인 일괄 정산이 완전히 같은 결과를 낸다', () => {
    const s0 = huntingState({ inventory: { dried_meat: 10 }, combatFood: 'dried_meat' });

    const offline = simulate(s0, T0 + 120_000).state;

    let online = s0;
    for (let t = T0 + 200; t <= T0 + 120_000; t += 200) {
      online = simulate(online, t).state;
    }

    expect(online).toEqual(offline);
  });

  it('전리품은 처치 순번 시드라 같은 입력이면 항상 같다', () => {
    const s0 = huntingState();
    const a = simulate(s0, T0 + 300_000).state;
    const b = simulate(s0, T0 + 300_000).state;
    expect(a.inventory).toEqual(b.inventory);
  });

  it('사냥 중이 아니면 HP가 분당 체력 레벨만큼 회복된다', () => {
    const s0 = stateWith({ hp: 50 });
    const { state } = simulate(s0, T0 + 60_000); // 1분, 체력 Lv10
    expect(state.hp).toBe(60);
  });
});

describe('던전', () => {
  const strong = () =>
    stateWith({
      skills: skillsWith({ attack: { xp: xpForLevel(40) }, hitpoints: { xp: xpForLevel(30) } }),
      equipment: { weapon: 'silver_sword', armor: 'iron_armor' },
      hp: 300,
      inventory: { dried_meat: 20 },
      combatFood: 'dried_meat',
    });

  it('준비된 캐릭터는 클리어하고 미스릴 강화석을 얻는다', () => {
    const { state, result, error } = attemptDungeon(strong(), 'goblin_den', T0);
    expect(error).toBeUndefined();
    expect(result!.success).toBe(true);
    expect(state.inventory['mithril_core']).toBe(1);
    expect(state.monsterKills['goblin_chief']).toBe(1);
    expect(result!.xp.attack).toBeGreaterThan(0);
  });

  it('맨몸 캐릭터는 첫 몬스터에서 패배한다 — 아이템 손실 없음, HP 1 생환', () => {
    const s0 = stateWith({ inventory: { normal_log: 5 } });
    const { state, result } = attemptDungeon(s0, 'goblin_den', T0);
    expect(result!.success).toBe(false);
    expect(result!.fights[0].defeated).toBe(false);
    expect(state.hp).toBe(1);
    expect(state.inventory['normal_log']).toBe(5);
    expect(state.inventory['mithril_core']).toBeUndefined();
  });

  it('쿨다운 중에는 재도전할 수 없다', () => {
    const first = attemptDungeon(strong(), 'goblin_den', T0);
    expect(first.state.dungeonCooldowns['goblin_den']).toBe(T0 + DUNGEON_COOLDOWN_MS);
    expect(attemptDungeon(first.state, 'goblin_den', T0 + 1000).error).toBe('on-cooldown');
    expect(
      attemptDungeon(first.state, 'goblin_den', T0 + DUNGEON_COOLDOWN_MS + 1).error,
    ).toBeUndefined();
  });

  it('사냥 작업 중에는 입장할 수 없다', () => {
    const hunting = startAction(strong(), 'hunt_slime').state;
    expect(attemptDungeon(hunting, 'goblin_den', T0).error).toBe('combat-in-progress');
  });
});

describe('세이브 마이그레이션 v2→v3', () => {
  it('전투 필드를 기본값으로 채운다', () => {
    const v2 = {
      version: 2,
      createdAt: T0,
      lastTickAt: T0,
      gold: 100,
      skills: { woodcutting: { xp: 500 }, mining: { xp: 0 }, smithing: { xp: 0 } },
      inventory: { iron_bar: 3 },
      activeActions: [{ skillId: 'woodcutting', actionId: 'wc_normal', progressMs: 0 }],
    };
    const migrated = migrateSave(v2);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect(migrated!.skills.attack.xp).toBe(0);
    expect(migrated!.skills.hitpoints.xp).toBe(xpForLevel(10));
    expect(migrated!.hp).toBe(100);
    expect(migrated!.equipment).toEqual({ weapon: null, armor: null });
    expect(migrated!.skills.woodcutting.xp).toBe(500); // 기존 진행 유지
    expect(migrated!.activeActions).toHaveLength(1);
  });
});

describe('damageTakenPerKill 정수성', () => {
  it('모든 몬스터에 대해 피해량은 정수다 (틱/오프라인 동일성의 전제)', () => {
    const stats = computeStats(stateWith());
    for (const monster of huntableMonsters()) {
      const dmg = damageTakenPerKill(stats, monster);
      expect(Number.isInteger(dmg)).toBe(true);
      expect(timeToKillMs(stats, monster)).toBeGreaterThan(0);
    }
  });
});
