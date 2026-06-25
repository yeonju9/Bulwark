import { describe, expect, it } from 'vitest';
import { attemptDungeon } from './combat/dungeon';
import { computeVillageStats, WAVE_PERIOD_MS } from './combat/village';
import { damageTakenPerKill } from './combat/stats';
import { buildBuilding, reinforceWall, repairBuilding, selectWaveTier, startAction } from './commands';
import { unlockedTier } from './data/stages';
import { fieldMonsters } from './data/monsters';
import { simulate } from './simulate';
import { createInitialState, migrateSave, SAVE_VERSION } from './state';
import { xpForLevel } from './xp';
import type { BuildingSlot, GameState, SkillId, SkillState, Village } from './types';

const T0 = 1_000_000;

/** 4개 던전 최초 클리어 → 모든 티어(T5까지) 해금 */
const ALL_CLEARED = { thicket_burrow: 1, wolf_hollow: 1, goblin_den: 1, orc_warcamp: 1 };

function skillsWith(patch: Partial<Record<SkillId, SkillState>>): Record<SkillId, SkillState> {
  return { ...createInitialState(T0).skills, ...patch };
}

function stateWith(patch?: Partial<GameState>): GameState {
  return { ...createInitialState(T0), ...patch };
}

function villageWith(patch: Partial<Village>): Village {
  return { ...createInitialState(T0).village, ...patch };
}

function setCell(buildings: (BuildingSlot | null)[], cell: number, slot: BuildingSlot | null) {
  return buildings.map((b, i) => (i === cell ? slot : b));
}

describe('computeVillageStats', () => {
  it('새 마을: 본부 + 스킬 보조로 스탯이 나온다', () => {
    const fresh = computeVillageStats(createInitialState(T0));
    // 본부 hp150·공5·방3 + 체력Lv10×10 + 공격Lv1×1
    expect(fresh).toEqual({ attackLevel: 1, hpLevel: 10, maxHp: 250, attackPower: 6, defense: 3 });
  });

  it('성벽 레벨은 최대 HP와 방어를 누적해서 올린다', () => {
    const stats = computeVillageStats(stateWith({ village: villageWith({ wallLevel: 3 }) }));
    expect(stats.maxHp).toBe(250 + 3 * 50);
    expect(stats.defense).toBe(3 + 3 * 3);
  });

  it('병영은 공격력을 더하고, 파손되면 기여가 멎는다', () => {
    const base = createInitialState(T0);
    const built = stateWith({
      village: villageWith({ buildings: setCell(base.village.buildings, 0, { id: 'barracks', damaged: false }) }),
    });
    expect(computeVillageStats(built).attackPower).toBe(6 + 12); // 병영 공격 12

    const damaged = stateWith({
      village: villageWith({ buildings: setCell(base.village.buildings, 0, { id: 'barracks', damaged: true }) }),
    });
    expect(computeVillageStats(damaged).attackPower).toBe(6);
  });

  it('장비는 마을 공격/방어에 합산된다 (무기→공격, 방어구→방어)', () => {
    const armed = computeVillageStats(
      stateWith({ equipment: { weapon: 'copper_sword', armor: 'leather_armor' } }),
    );
    expect(armed.attackPower).toBe(6 + 4);
    expect(armed.defense).toBe(3 + 4);
  });
});

describe('웨이브 방어 — 안전 티어', () => {
  it('압도하는 티어(net≤0)는 HP가 깎이지 않고 보상만 쌓인다', () => {
    const s0 = createInitialState(T0); // T1 슬라임×2 — 새 마을이 압도
    const { state, gains } = simulate(s0, T0 + 5 * WAVE_PERIOD_MS);
    expect(gains.wave?.wavesWon).toBe(5);
    expect(gains.wave?.defeated).toBe(false);
    expect(state.village.hp).toBe(250); // 손실 없음
    expect(state.village.underSiege).toBe(false);
    expect(state.monsterKills['slime']).toBe(10); // 5웨이브 × 2마리
    expect(gains.xp.attack).toBeGreaterThan(0);
  });

  it('HP가 깎여 있어도 안전 티어에서는 자연 회복으로 차오른다', () => {
    const s0 = stateWith({ village: villageWith({ hp: 100 }) });
    const { state } = simulate(s0, T0 + 3 * WAVE_PERIOD_MS);
    expect(state.village.hp).toBeGreaterThan(100);
    expect(state.village.hp).toBeLessThanOrEqual(250);
  });
});

describe('웨이브 방어 — 패배와 농성', () => {
  /** T5(오크×2) 해금, 새 마을 스탯 → 1웨이브도 못 버틴다 */
  function overwhelmed(patch?: Partial<Village>): GameState {
    return stateWith({ waveTier: 5, dungeonClears: ALL_CLEARED, village: villageWith({ ...patch }) });
  }

  it('버틸 수 없으면 패배해 성벽이 먼저 무너지고 농성에 들어간다', () => {
    const { state, gains } = simulate(overwhelmed({ wallLevel: 2, hp: 350 }), T0 + WAVE_PERIOD_MS);
    expect(gains.wave?.defeated).toBe(true);
    expect(gains.wave?.damaged).toBe('wall');
    expect(gains.wave?.wallLevelAfter).toBe(1);
    expect(state.village.wallLevel).toBe(1);
    expect(state.village.underSiege).toBe(true);
  });

  it('성벽이 0이면 병영이 파손된다 (본부는 제외)', () => {
    const base = createInitialState(T0);
    const s = overwhelmed({
      wallLevel: 0,
      buildings: setCell(base.village.buildings, 0, { id: 'barracks', damaged: false }),
    });
    const { state, gains } = simulate(s, T0 + WAVE_PERIOD_MS);
    expect(gains.wave?.defeated).toBe(true);
    expect(gains.wave?.damaged).toBe('barracks');
    expect(state.village.buildings[0]?.damaged).toBe(true);
    expect(state.village.buildings[4]?.id).toBe('headquarters'); // 본부 멀쩡
    expect(state.village.buildings[4]?.damaged).toBe(false);
  });

  it('농성 중에는 웨이브가 더 이상 정산되지 않는다 (피해·보상 없음)', () => {
    const lost = simulate(overwhelmed({ wallLevel: 2, hp: 350 }), T0 + WAVE_PERIOD_MS).state;
    expect(lost.village.underSiege).toBe(true);
    const r = simulate(lost, lost.lastTickAt + 20 * WAVE_PERIOD_MS);
    expect(r.gains.wave).toBeUndefined();
    expect(r.state.village.wallLevel).toBe(1); // 추가 파손 없음
  });

  it('보급품이 있으면 한 웨이브라도 더 버틴다', () => {
    const noSupply = simulate(overwhelmed({ wallLevel: 2, hp: 350 }), T0 + WAVE_PERIOD_MS);
    const supplied = simulate(
      stateWith({
        waveTier: 5,
        dungeonClears: ALL_CLEARED,
        village: villageWith({ wallLevel: 2, hp: 350 }),
        combatFood: 'cooked_shark',
        inventory: { cooked_shark: 200 },
      }),
      T0 + WAVE_PERIOD_MS,
    );
    expect(noSupply.gains.wave!.defeated).toBe(true);
    expect(noSupply.gains.wave!.wavesWon).toBe(0); // 보급품 없으면 첫 웨이브에서 패배
    expect(supplied.gains.wave!.wavesWon).toBeGreaterThan(0);
    expect(supplied.state.inventory['cooked_shark']).toBeLessThan(200); // 소비됨
  });
});

describe('웨이브 방어 — 결정성과 오프라인', () => {
  it('실시간 틱 누적과 오프라인 일괄 정산이 완전히 같은 결과를 낸다 (HP·보급·레벨업 포함)', () => {
    // 보급품으로 버티며 레벨업이 일어나는 위험 구간 — 매 웨이브 스탯 재계산의 동일성 검증
    const s0 = stateWith({
      waveTier: 5,
      dungeonClears: ALL_CLEARED,
      village: villageWith({ wallLevel: 2, hp: 350 }),
      combatFood: 'cooked_shark',
      inventory: { cooked_shark: 200 },
    });
    const end = T0 + 6 * WAVE_PERIOD_MS;

    const offline = simulate(s0, end).state;
    let online = s0;
    for (let t = T0 + 5_000; t < end; t += 5_000) online = simulate(online, t).state;
    online = simulate(online, end).state;

    expect(online).toEqual(offline);
  });

  it('채집 작업과 웨이브가 함께 돌아도 틱/오프라인 정산이 동일하다', () => {
    // 단일 채집(벌목, 배치 불변)을 켠 채 위험 티어 방어 — settleSpan↔settleWaves 인터리브 결정성
    const base = stateWith({
      skills: skillsWith({ woodcutting: { xp: xpForLevel(30) } }),
      waveTier: 5,
      dungeonClears: ALL_CLEARED,
      village: villageWith({ wallLevel: 2, hp: 350 }),
      combatFood: 'cooked_shark',
      inventory: { cooked_shark: 200 },
    });
    const s0 = startAction(base, 'wc_normal').state;
    const end = T0 + 6 * WAVE_PERIOD_MS;

    const offline = simulate(s0, end).state;
    let online = s0;
    for (let t = T0 + 5_000; t < end; t += 5_000) online = simulate(online, t).state;
    online = simulate(online, end).state;

    expect(online.inventory['normal_log']).toBeGreaterThan(0);
    expect(online).toEqual(offline);
  });

  it('오프라인 정산은 보상(전리품·XP)을 약 50%로 준다 (진행은 동일)', () => {
    const s0 = createInitialState(T0); // 안전 티어 — HP 손실 없음, 보상만 비교
    const end = T0 + 40 * WAVE_PERIOD_MS;
    const online = simulate(s0, end);
    const offline = simulate(s0, end, { offline: true });

    // 진행(웨이브 수)·처치 수는 동일, XP는 정확히 절반(웨이브당 정수 퀀텀)
    expect(offline.gains.wave?.wavesWon).toBe(online.gains.wave?.wavesWon);
    expect(offline.gains.kills['slime']).toBe(online.gains.kills['slime']);
    expect(offline.gains.xp.attack).toBe(Math.round((online.gains.xp.attack ?? 0) / 2));

    // 전리품은 드랍 확률 절반 → 기대값 50% (0으로 붕괴하지 않고, 표본이 크면 대략 절반)
    const onJelly = online.gains.itemsGained['jelly'] ?? 0;
    const offJelly = offline.gains.itemsGained['jelly'] ?? 0;
    expect(onJelly).toBeGreaterThan(20);
    expect(offJelly).toBeGreaterThan(0);
    expect(offJelly).toBeLessThan(onJelly);
    expect(offJelly).toBeGreaterThanOrEqual(Math.floor(onJelly * 0.3));
    expect(offJelly).toBeLessThanOrEqual(Math.ceil(onJelly * 0.7));
  });
});

describe('던전 (수동 공략)', () => {
  const strong = () =>
    stateWith({
      skills: skillsWith({ attack: { xp: xpForLevel(60) }, hitpoints: { xp: xpForLevel(50) } }),
      equipment: { weapon: 'mithril_sword', armor: 'mithril_armor' },
      inventory: { cooked_salmon: 30 },
      combatFood: 'cooked_salmon',
    });

  it('강한 마을은 클리어하고 최초 보상 + 클리어 횟수가 쌓인다', () => {
    const { state, result, error } = attemptDungeon(strong(), 'goblin_den');
    expect(error).toBeUndefined();
    expect(result!.success).toBe(true);
    expect(result!.firstClear).toBe(true);
    expect(state.inventory['mithril_core']).toBe(1); // 최초 보상
    expect(state.dungeonClears['goblin_den']).toBe(1);
  });

  it('쿨다운 없이 재도전 가능하며, 반복 클리어는 소량 보상만 준다', () => {
    const first = attemptDungeon(strong(), 'goblin_den');
    const second = attemptDungeon(first.state, 'goblin_den');
    expect(second.error).toBeUndefined();
    expect(second.result!.firstClear).toBe(false);
    expect(second.state.dungeonClears['goblin_den']).toBe(2);
    expect(second.state.inventory['mithril_core']).toBe(1); // 반복은 강화석을 더 주지 않음
  });

  it('약한 마을은 패배한다 — 클리어 횟수 증가 없음, 손실 없음', () => {
    const s0 = stateWith({ inventory: { normal_log: 5 } });
    const { state, result } = attemptDungeon(s0, 'goblin_den');
    expect(result!.success).toBe(false);
    expect(state.dungeonClears['goblin_den']).toBeUndefined();
    expect(state.inventory['normal_log']).toBe(5);
  });

  it('알 수 없는 던전은 거부한다', () => {
    expect(attemptDungeon(stateWith(), 'nope').error).toBe('unknown-dungeon');
  });
});

describe('웨이브 티어 해금', () => {
  it('던전 최초 클리어 수로 티어가 해금되고, 잠긴 티어는 선택할 수 없다', () => {
    const fresh = createInitialState(T0);
    expect(unlockedTier(fresh)).toBe(1);
    expect(selectWaveTier(fresh, 3).error).toBe('tier-locked');

    const cleared2 = stateWith({ dungeonClears: { thicket_burrow: 1, wolf_hollow: 1 } });
    expect(unlockedTier(cleared2)).toBe(3);
    expect(selectWaveTier(cleared2, 3).state.waveTier).toBe(3);
    expect(selectWaveTier(cleared2, 4).error).toBe('tier-locked');
  });
});

describe('마을 건설·강화 커맨드', () => {
  const rich = () =>
    stateWith({ gold: 100_000, inventory: { normal_log: 200, copper_bar: 200, oak_log: 200, iron_bar: 200 } });

  it('빈 터에 병영을 짓고 비용을 차감한다', () => {
    const { state, error } = buildBuilding(rich(), 0, 'barracks');
    expect(error).toBeUndefined();
    expect(state.village.buildings[0]).toEqual({ id: 'barracks', damaged: false });
    expect(state.gold).toBeLessThan(100_000);
  });

  it('본부 칸이나 이미 찬 칸에는 못 짓는다', () => {
    expect(buildBuilding(rich(), 4, 'barracks').error).toBe('cell-occupied'); // 중앙 본부
    const built = buildBuilding(rich(), 1, 'barracks').state;
    expect(buildBuilding(built, 1, 'barracks').error).toBe('cell-occupied');
  });

  it('자원이 부족하면 건설할 수 없다', () => {
    expect(buildBuilding(stateWith({ gold: 0 }), 0, 'barracks').error).toBe('not-enough-gold');
  });

  it('성벽을 강화하면 레벨이 오른다', () => {
    const { state, error } = reinforceWall(rich());
    expect(error).toBeUndefined();
    expect(state.village.wallLevel).toBe(1);
  });

  it('강화/수리는 농성을 해제하고 마을을 가득 채운다', () => {
    const sieged = stateWith({
      gold: 100_000,
      inventory: { normal_log: 200, copper_bar: 200 },
      village: villageWith({ wallLevel: 1, hp: 5, underSiege: true }),
    });
    const { state } = reinforceWall(sieged);
    expect(state.village.underSiege).toBe(false);
    expect(state.village.hp).toBe(computeVillageStats(state).maxHp);
  });

  it('파손된 병영을 수리하면 효과가 돌아온다', () => {
    const base = createInitialState(T0);
    const damagedState = stateWith({
      gold: 100_000,
      inventory: { normal_log: 200, copper_bar: 200 },
      village: villageWith({ buildings: setCell(base.village.buildings, 0, { id: 'barracks', damaged: true }) }),
    });
    expect(computeVillageStats(damagedState).attackPower).toBe(6); // 파손 → 기여 없음
    const { state, error } = repairBuilding(damagedState, 0);
    expect(error).toBeUndefined();
    expect(state.village.buildings[0]?.damaged).toBe(false);
    expect(computeVillageStats(state).attackPower).toBe(6 + 12);
  });
});

describe('damageTakenPerKill 정수성 (틱/오프라인 동일성의 전제)', () => {
  it('새 마을 스탯으로 모든 필드 몬스터 피해량이 정수다', () => {
    const stats = computeVillageStats(createInitialState(T0));
    for (const monster of fieldMonsters()) {
      const dmg = damageTakenPerKill(stats, monster);
      expect(Number.isInteger(dmg)).toBe(true);
    }
  });
});

describe('세이브 마이그레이션 v4→v5 (마을 방어 전환)', () => {
  it('캐릭터 HP→마을 HP, 사냥 작업 제거, 던전 이력→클리어, 마을 기본값', () => {
    const v4 = {
      version: 4,
      createdAt: T0,
      lastTickAt: T0,
      gold: 500,
      skills: {
        woodcutting: { xp: 1000 }, mining: { xp: 0 }, smithing: { xp: 0 },
        attack: { xp: 300 }, hitpoints: { xp: xpForLevel(12) },
        fishing: { xp: 0 }, cooking: { xp: 0 }, alchemy: { xp: 0 },
      },
      inventory: { mithril_core: 1 },
      activeActions: [
        { skillId: 'woodcutting', actionId: 'wc_normal', progressMs: 100 },
        { skillId: 'attack', actionId: 'hunt_slime', progressMs: 0 }, // 제거 대상
      ],
      equipment: { weapon: 'iron_sword', armor: null },
      hp: 80,
      combatFood: 'dried_meat',
      monsterKills: { slime: 50, goblin_chief: 1 },
      dungeonCooldowns: { goblin_den: T0 + 999 },
      buffs: [],
      upgrades: {},
      actionCycles: {},
    };
    const m = migrateSave(v4);
    expect(m).not.toBeNull();
    expect(m!.version).toBe(SAVE_VERSION);
    // 사냥 작업 제거, 채집 작업 유지
    expect(m!.activeActions).toEqual([
      { skillId: 'woodcutting', actionId: 'wc_normal', progressMs: 100 },
    ]);
    // 마을 기본값
    expect(m!.village.wallLevel).toBe(0);
    expect(m!.village.buildings[4]?.id).toBe('headquarters');
    expect(m!.village.underSiege).toBe(false);
    expect(m!.mapStage).toBe(1);
    expect(m!.waveTier).toBe(1);
    // 기존 HP는 새 최대 HP로 클램프되어 보존 (80 ≤ maxHp)
    expect(m!.village.hp).toBe(80);
    // goblin_chief 처치 이력 → goblin_den 클리어 1회 인정
    expect(m!.dungeonClears['goblin_den']).toBe(1);
    // 제거된 필드
    expect((m as unknown as Record<string, unknown>)['hp']).toBeUndefined();
    expect((m as unknown as Record<string, unknown>)['dungeonCooldowns']).toBeUndefined();
    // 기존 진행 보존
    expect(m!.skills.woodcutting.xp).toBe(1000);
    expect(m!.equipment.weapon).toBe('iron_sword');
  });
});
