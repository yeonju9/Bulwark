import { combatBuffMultipliers } from '../buffs';
import { getBuilding, wallStats } from '../data/buildings';
import { getItem } from '../data/items';
import { getMonster } from '../data/monsters';
import { currentTier } from '../data/stages';
import { lootRollsForKill } from '../rng';
import { levelFromXp } from '../xp';
import {
  damageTakenPerKill,
  hitChance,
  hitpointsXpPerKill,
  REGEN_PER_MINUTE_PER_HP_LEVEL,
  timeToKillMs,
  type VillageStats,
} from './stats';
import type {
  Gains,
  GameState,
  MonsterDef,
  MonsterId,
  SiegeHit,
  SkillId,
  Village,
  WaveReport,
  WaveTierDef,
} from '../types';

/** 한 웨이브 주기(잔잔 + 침공)의 전체 길이 (밸런스 조정 대상) */
export const WAVE_PERIOD_MS = 5 * 60 * 1000;
/** 주기 중 실시간 전투가 벌어지는 침공 구간 길이 */
export const INVASION_DURATION_MS = 2 * 60 * 1000;
/** 주기 중 침공 전 잔잔(회복·준비) 구간 길이 */
export const CALM_DURATION_MS = WAVE_PERIOD_MS - INVASION_DURATION_MS;
/** 침공 중 자연 회복은 잔잔 회복의 이 비율만큼만 (침공 중에도 조금은 차오름) */
export const INVASION_REGEN_FACTOR = 0.4;
/** 마을 HP가 최대치의 이 비율 밑으로 떨어지면 보급품을 자동 소비한다 */
export const SUPPLY_HP_THRESHOLD = 0.1;
/** 회복을 적용하는 진행 단위(ms). 이 고정 진행점에서만 HP를 바꿔 틱/오프라인 동일성을 지킨다 */
const REGEN_TICK_MS = 1000;
/** Gains.siegeHits에 보관하는 최근 타격 이벤트 상한 (UI 연출용) */
const MAX_SIEGE_HITS = 48;

/** 마을 공격력 = 건물 + (공격 레벨 × 이 값) + 무기 */
export const ATTACK_PER_SKILL_LEVEL = 1;
/** 마을 최대 HP = 건물 + 성벽 + (체력 레벨 × 이 값) */
export const HP_PER_SKILL_LEVEL = 10;
/** 웨이브 1회 승리당 기본 골드 보상 (티어 보상배율을 곱한다 — 마을 방어로 성벽·수리비를 일부 자급) */
export const WAVE_GOLD_BASE = 25;

/**
 * 마을 스탯 = 건물(본부+병영 등, 파손 제외) 주력 + 성벽 링 + 공격/체력 스킬 보조 + 장비 보조.
 * 무기→마을 공격력, 방어구→마을 방어력. 전투 물약은 곱연산으로만 개입(정수 반올림).
 * 순수 함수 — 같은 입력이면 같은 결과.
 */
export function computeVillageStats(state: GameState): VillageStats {
  const attackLevel = levelFromXp(state.skills.attack.xp);
  const hpLevel = levelFromXp(state.skills.hitpoints.xp);

  let bHp = 0;
  let bAtk = 0;
  let bDef = 0;
  for (const slot of state.village.buildings) {
    if (!slot || slot.damaged) continue;
    const def = getBuilding(slot.id);
    bHp += def.hp;
    bAtk += def.attack;
    bDef += def.defense;
  }
  const wall = wallStats(state.village.wallLevel);

  let eqAtk = 0;
  let eqDef = 0;
  for (const itemId of Object.values(state.equipment)) {
    if (!itemId) continue;
    const equip = getItem(itemId).equip;
    if (!equip) continue;
    eqAtk += equip.attack ?? 0;
    eqDef += equip.defense ?? 0;
  }

  let attackPower = bAtk + attackLevel * ATTACK_PER_SKILL_LEVEL + eqAtk;
  let defense = bDef + wall.defense + eqDef;
  const maxHp = bHp + wall.hp + hpLevel * HP_PER_SKILL_LEVEL;

  const buff = combatBuffMultipliers(state);
  attackPower = Math.round(attackPower * buff.attack);
  defense = Math.round(defense * buff.defense);

  return { attackLevel, hpLevel, maxHp, attackPower, defense };
}

/** XP를 부여하고 레벨업을 Gains에 기록한다 (웨이브·던전 공용) */
export function grantXp(state: GameState, gains: Gains, skillId: SkillId, amount: number): void {
  if (amount <= 0) return;
  const skill = state.skills[skillId];
  const before = levelFromXp(skill.xp);
  skill.xp += amount;
  const after = levelFromXp(skill.xp);
  gains.xp[skillId] = (gains.xp[skillId] ?? 0) + amount;
  if (after > before) {
    const existing = gains.levelUps[skillId];
    gains.levelUps[skillId] = { from: existing?.from ?? before, to: after };
  }
}

/** 웨이브 1회를 막는 동안 마을이 받는 기대 총 피해 (몬스터 합). 처치 불가면 Infinity */
export function grossWaveDamage(stats: VillageStats, monsterIds: readonly string[]): number {
  let dmg = 0;
  for (const id of monsterIds) {
    const d = damageTakenPerKill(stats, getMonster(id));
    if (!Number.isFinite(d)) return Infinity;
    dmg += d;
  }
  return dmg;
}

/** ms당 자연 회복량 (체력 레벨 비례). 잔잔=×1, 침공=×INVASION_REGEN_FACTOR */
function regenPerMs(stats: VillageStats): number {
  return (REGEN_PER_MINUTE_PER_HP_LEVEL * stats.hpLevel) / 60_000;
}

/** 몬스터 1회 공격이 마을 HP에 주는 피해 (정수 — HP 산술 정수 유지) */
function damagePerMonsterAttack(stats: VillageStats, attack: number): number {
  return Math.round(attack * hitChance(attack, stats.defense));
}

/**
 * 한 번의 침공(2분 전투) 동안의 기대 순손익을 추정한다 — 맵 상세 패널 예측용.
 * 침공 시간을 몬스터별 평균 처치시간으로 나눠 처치 수를 잡고, 받은 피해 − 회복으로 net을 낸다.
 * 처치 불가(공격력 0)면 Infinity.
 */
export function estimateInvasion(
  stats: VillageStats,
  monsterIds: readonly MonsterId[],
): { kills: number; damage: number; regen: number; net: number } {
  if (stats.attackPower <= 0 || monsterIds.length === 0) {
    return { kills: 0, damage: Infinity, regen: 0, net: Infinity };
  }
  // 몬스터 타입을 순환하며 침공 시간을 채운다. 평균 1마리 처치시간·평균 피해로 기대값 산정.
  let totalTtk = 0;
  let totalDmgPerKill = 0;
  for (const id of monsterIds) {
    const m = getMonster(id);
    const ttk = timeToKillMs(stats, m);
    if (!Number.isFinite(ttk)) return { kills: 0, damage: Infinity, regen: 0, net: Infinity };
    totalTtk += ttk;
    // 한 마리당 받는 피해 ≈ (처치시간 / 공격주기) 회의 공격 × 공격당 피해
    const hits = Math.floor(ttk / m.attackIntervalMs);
    totalDmgPerKill += hits * damagePerMonsterAttack(stats, m.attack);
  }
  const avgTtk = totalTtk / monsterIds.length;
  const avgDmg = totalDmgPerKill / monsterIds.length;
  const kills = avgTtk > 0 ? Math.floor(INVASION_DURATION_MS / avgTtk) : 0;
  const damage = Math.round(kills * avgDmg);
  // 회복: 잔잔(3분 ×1) + 침공(2분 ×INVASION_REGEN_FACTOR)
  const regen = Math.round(
    regenPerMs(stats) * (CALM_DURATION_MS + INVASION_DURATION_MS * INVASION_REGEN_FACTOR),
  );
  return { kills, damage, regen, net: damage - regen };
}

/**
 * 패배 시 구조물 1개 손상. 우선순위: 성벽 레벨 1 하락 → 성벽이 0이면 멀쩡한 비고정 건물 1채 파손.
 * 본부(고정)는 제외. 부술 게 없으면 null (농성만 진입).
 */
function damageStructure(v: Village): 'wall' | 'barracks' | null {
  if (v.wallLevel > 0) {
    v.wallLevel -= 1;
    return 'wall';
  }
  for (const slot of v.buildings) {
    if (slot && !slot.damaged && !getBuilding(slot.id).fixed) {
      slot.damaged = true;
      return 'barracks';
    }
  }
  return null;
}

/** 가변 누적용 웨이브 요약을 보장한다(없으면 0으로 생성) */
function ensureWave(gains: Gains): WaveReport {
  if (!gains.wave) {
    gains.wave = {
      wavesWon: 0,
      goldWon: 0,
      xpWon: 0,
      damageTaken: 0,
      monstersDefeated: 0,
      defeated: false,
    };
  }
  return gains.wave;
}

/** UI 플로팅 숫자용 타격 이벤트 기록 (오프라인 정산에선 연출이 없으므로 건너뜀) */
function recordHit(gains: Gains, offline: boolean, hit: SiegeHit): void {
  if (offline) return;
  if (!gains.siegeHits) gains.siegeHits = [];
  gains.siegeHits.push(hit);
  if (gains.siegeHits.length > MAX_SIEGE_HITS) gains.siegeHits.shift();
}

/**
 * 몬스터 1마리 처치의 전리품을 굴려 넣고 처치 수를 올린다 (시드: 전역 처치 순번).
 * 오프라인 보상 50%는 드랍 확률에 halving을 곱해 반영(같은 시드로 임계값만 낮춤 — 결정적).
 */
function rollMonsterLoot(
  state: GameState,
  gains: Gains,
  monster: MonsterDef,
  halving: number,
): void {
  const killsBefore = state.monsterKills[monster.id] ?? 0;
  const roll = lootRollsForKill(monster.id, killsBefore);
  for (const entry of monster.lootTable) {
    if (roll() < entry.chance * halving) {
      state.inventory[entry.itemId] = (state.inventory[entry.itemId] ?? 0) + entry.qty;
      gains.itemsGained[entry.itemId] = (gains.itemsGained[entry.itemId] ?? 0) + entry.qty;
    }
  }
  state.monsterKills[monster.id] = killsBefore + 1;
  gains.kills[monster.id] = (gains.kills[monster.id] ?? 0) + 1;
}

/** 회복 틱 1회 — 고정 진행점(REGEN_TICK_MS 경계)에서만 호출되어 틱/오프라인 동일성을 지킨다 */
function applyRegen(state: GameState, factor: number): void {
  const stats = computeVillageStats(state);
  const v = state.village;
  v.hp = Math.min(stats.maxHp, v.hp + regenPerMs(stats) * REGEN_TICK_MS * factor);
}

/** HP가 최대치의 SUPPLY_HP_THRESHOLD 밑이면 보급품을 자동 소비해 임계치 위로 끌어올린다 */
function useSupplyIfLow(state: GameState, gains: Gains, stats: VillageStats): void {
  const v = state.village;
  if (!state.combatFood) return;
  const threshold = SUPPLY_HP_THRESHOLD * stats.maxHp;
  if (v.hp >= threshold) return;
  const heal = getItem(state.combatFood).food?.heal ?? 0;
  if (heal <= 0) return;
  const available = state.inventory[state.combatFood] ?? 0;
  if (available <= 0) return;
  const need = Math.ceil((threshold - v.hp) / heal);
  const used = Math.min(available, Math.max(1, need));
  const left = available - used;
  if (left > 0) state.inventory[state.combatFood] = left;
  else delete state.inventory[state.combatFood];
  gains.itemsConsumed[state.combatFood] = (gains.itemsConsumed[state.combatFood] ?? 0) + used;
  v.hp = Math.min(stats.maxHp, v.hp + used * heal);
}

/** 몬스터 1마리 처치: 전리품·XP 지급 + 요약 누적 (HP는 처치 자체로 깎이지 않음 — 피해는 공격에서) */
function onKill(
  state: GameState,
  gains: Gains,
  monster: MonsterDef,
  stats: VillageStats,
  tier: WaveTierDef,
  halving: number,
): void {
  rollMonsterLoot(state, gains, monster, halving);
  const atk = Math.round(monster.xp * tier.rewardMultiplier * halving);
  const nominalDmg = damageTakenPerKill(stats, monster);
  const hp = Math.round(
    hitpointsXpPerKill(Number.isFinite(nominalDmg) ? nominalDmg : 0) * tier.rewardMultiplier * halving,
  );
  grantXp(state, gains, 'attack', atk);
  grantXp(state, gains, 'hitpoints', hp);
  const w = ensureWave(gains);
  w.xpWon += atk + hp;
  w.monstersDefeated += 1;
}

/** 함락: 구조물 1개 손상(불변식: 정산당 최대 1개) + 농성 진입 + 침공 진행 초기화 */
function applyBreach(state: GameState, gains: Gains): void {
  const v = state.village;
  const damaged = damageStructure(v) ?? undefined;
  v.underSiege = true;
  v.waveProgressMs = 0;
  v.siegeProgressMs = 0;
  v.siegeKills = 0;
  const w = ensureWave(gains);
  w.defeated = true;
  w.damaged = damaged;
  w.wallLevelAfter = v.wallLevel;
}

/** 침공을 끝까지 버팀 → 격퇴 성공: 웨이브 수·골드·요약 갱신 + 다음 침공 위해 진행 초기화 */
function onInvasionComplete(
  state: GameState,
  gains: Gains,
  tier: WaveTierDef,
  halving: number,
): void {
  const v = state.village;
  v.wavesProcessed += 1;
  const gold = Math.round(WAVE_GOLD_BASE * tier.rewardMultiplier * halving);
  state.gold += gold;
  const w = ensureWave(gains);
  w.wavesWon += 1;
  w.goldWon += gold;
  v.siegeProgressMs = 0;
  v.siegeKills = 0;
}

/**
 * 침공 구간을 dt(ms)만큼 진행한다. 몬스터를 한 마리씩 상대하며, **고정 진행점의 정수 이벤트**
 * (몬스터 공격 = attackIntervalMs 배수, 처치 = ttk)에서만 HP/보상을 바꾼다. 부분 진행(이벤트 미도달)은
 * 진행도만 올린다 → 200ms 틱과 오프라인 일괄 정산이 동일 결과. 함락되면 true.
 */
function advanceInvasion(
  state: GameState,
  dt: number,
  gains: Gains,
  tier: WaveTierDef,
  halving: number,
  offline: boolean,
): boolean {
  const v = state.village;
  let left = dt;
  while (left > 0) {
    const stats = computeVillageStats(state);
    const monsterId = tier.monsters[v.siegeKills % tier.monsters.length];
    const monster = getMonster(monsterId);
    const ttk = timeToKillMs(stats, monster);
    if (!Number.isFinite(ttk)) {
      // 공격력 0 등으로 처치 불가 → 압도당해 함락
      applyBreach(state, gains);
      return true;
    }
    const ai = monster.attackIntervalMs;
    const nextAttack = (Math.floor(v.siegeProgressMs / ai) + 1) * ai;
    const nextEvent = Math.min(nextAttack, ttk);
    const need = nextEvent - v.siegeProgressMs;

    if (left < need) {
      // 이번 슬라이스로는 이벤트 도달 못 함 — 진행도만 올린다 (HP 불변)
      v.siegeProgressMs += left;
      v.waveProgressMs += left;
      return false;
    }

    v.siegeProgressMs = nextEvent;
    v.waveProgressMs += need;
    left -= need;

    if (nextEvent >= ttk) {
      // 처치 — 전리품·XP만 (데미지 숫자는 실제 공격 순간에만 띄운다)
      onKill(state, gains, monster, stats, tier, halving);
      v.siegeKills += 1;
      v.siegeProgressMs = 0;
    } else {
      // 몬스터 1회 공격 → 마을 피해(정수). **실제 HP 피해 1건당 데미지 숫자 1개**를 띄운다
      // (화면에 보이는 데미지 = 실제 마을 HP에 영향을 준 데미지와 1:1).
      const dmg = damagePerMonsterAttack(stats, monster.attack);
      v.hp -= dmg;
      ensureWave(gains).damageTaken += dmg;
      recordHit(gains, offline, { kind: 'incoming', monsterId, amount: dmg });
      // HP가 10% 밑이면 보급품 자동 소비
      useSupplyIfLow(state, gains, stats);
      if (v.hp < 1) {
        applyBreach(state, gains);
        return true;
      }
    }
  }
  return false;
}

/**
 * spanMs만큼 실시간 공성을 정산한다. state를 직접 변형. 농성 중이면 건너뛴다.
 *
 * 주기 = 잔잔(CALM_DURATION_MS, HP 회복) + 침공(INVASION_DURATION_MS, 실시간 전투).
 * span을 **단계 경계 + 회복 틱(REGEN_TICK_MS) 경계**로 잘게 쪼개 처리한다. HP·보상은 오직
 * 고정 진행점의 이벤트(몬스터 공격·처치·회복 틱)에서만 바뀌고, 부분 진행은 진행도만 올리므로
 * 실시간 200ms 틱 누적과 오프라인 일괄 정산이 묶음 크기와 무관하게 완전히 같은 결과를 낸다.
 */
export function settleSiege(
  state: GameState,
  spanMs: number,
  gains: Gains,
  offline: boolean,
): void {
  const v = state.village;
  if (v.underSiege || spanMs <= 0) return;

  const tier = currentTier(state);
  const halving = offline ? 0.5 : 1;

  let remaining = spanMs;
  while (remaining > 0) {
    const pos = v.waveProgressMs;
    const inInvasion = pos >= CALM_DURATION_MS;
    const phaseEnd = inInvasion ? WAVE_PERIOD_MS : CALM_DURATION_MS;
    const nextRegen = (Math.floor(pos / REGEN_TICK_MS) + 1) * REGEN_TICK_MS;
    const sliceEnd = Math.min(phaseEnd, nextRegen);
    const dt = Math.min(remaining, sliceEnd - pos);

    if (inInvasion) {
      if (advanceInvasion(state, dt, gains, tier, halving, offline)) return; // 함락
    } else {
      v.waveProgressMs += dt;
    }
    remaining -= dt;

    const reached = v.waveProgressMs;
    // 회복 틱 경계에 정확히 닿았으면 회복 lump (잔잔=×1, 침공=×INVASION_REGEN_FACTOR)
    if (reached === nextRegen) {
      applyRegen(state, inInvasion ? INVASION_REGEN_FACTOR : 1);
    }
    if (reached >= WAVE_PERIOD_MS) {
      // 침공을 끝까지 버팀 → 격퇴 성공, 다음 주기로 랩
      onInvasionComplete(state, gains, tier, halving);
      v.waveProgressMs = reached - WAVE_PERIOD_MS;
    } else if (!inInvasion && reached >= CALM_DURATION_MS) {
      // 잔잔 → 침공 진입: 새 침공 시작 (진행 초기화)
      v.siegeProgressMs = 0;
      v.siegeKills = 0;
    }
  }
}
