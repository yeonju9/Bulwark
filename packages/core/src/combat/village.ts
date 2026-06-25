import { combatBuffMultipliers } from '../buffs';
import { getBuilding, wallStats } from '../data/buildings';
import { getItem } from '../data/items';
import { getMonster } from '../data/monsters';
import { currentTier } from '../data/stages';
import { lootRollsForKill } from '../rng';
import { levelFromXp } from '../xp';
import {
  damageTakenPerKill,
  hitpointsXpPerKill,
  REGEN_PER_MINUTE_PER_HP_LEVEL,
  type VillageStats,
} from './stats';
import type { Gains, GameState, SkillId, Village, WaveTierDef } from '../types';

/** 웨이브 침공 주기. 이 주기마다 마을이 1회 자동 공격받는다 (밸런스 조정 대상) */
export const WAVE_PERIOD_MS = 3 * 60 * 1000;

/** 마을 공격력 = 건물 + (공격 레벨 × 이 값) + 무기 */
export const ATTACK_PER_SKILL_LEVEL = 1;
/** 마을 최대 HP = 건물 + 성벽 + (체력 레벨 × 이 값) */
export const HP_PER_SKILL_LEVEL = 10;

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

/** 웨이브 주기당 마을 자연 회복량 (정수 — HP 산술 정수 유지) */
function regenPerWave(stats: VillageStats): number {
  return Math.round((WAVE_PERIOD_MS / 60_000) * stats.hpLevel * REGEN_PER_MINUTE_PER_HP_LEVEL);
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

/**
 * 승리한 웨이브 1회의 전리품을 인벤토리에 굴려 넣고 처치 수를 올린다 (시드: 전역 처치 순번).
 * 오프라인 보상 50%는 **드랍 확률에 halving을 곱해** 반영한다 — 같은 시드로 임계값만 낮추므로
 * 결정적이고, 웨이브당 즉시 지급이라 qty 1짜리가 floor로 0이 되는 붕괴가 없으며, 드랍이 보급품
 * (dried_meat 등)일 때 이후 웨이브로의 피드백도 일관된다. 온라인은 halving=1로 종전과 동일.
 */
function rollWaveLoot(state: GameState, gains: Gains, tier: WaveTierDef, halving: number): void {
  for (const monsterId of tier.monsters) {
    const monster = getMonster(monsterId);
    const killsBefore = state.monsterKills[monsterId] ?? 0;
    const roll = lootRollsForKill(monsterId, killsBefore);
    for (const entry of monster.lootTable) {
      if (roll() < entry.chance * halving) {
        state.inventory[entry.itemId] = (state.inventory[entry.itemId] ?? 0) + entry.qty;
        gains.itemsGained[entry.itemId] = (gains.itemsGained[entry.itemId] ?? 0) + entry.qty;
      }
    }
    state.monsterKills[monsterId] = killsBefore + 1;
    gains.kills[monsterId] = (gains.kills[monsterId] ?? 0) + 1;
  }
}

/**
 * spanMs만큼 웨이브 방어를 정산한다. state를 직접 변형. 농성 중이면 건너뛴다.
 *
 * 웨이브를 한 회씩 순차 처리하며 매 웨이브 스탯을 다시 계산한다 — 누적 처치 XP로
 * 마을이 강해지는 변화가 "이번 웨이브"의 판정에 반영된다. 각 웨이브의 결과가 그 시점까지의
 * 누적 상태(HP·인벤·XP)만의 함수이므로, 실시간 200ms 틱 누적과 오프라인 일괄 정산이
 * 묶음 크기와 무관하게 완전히 같은 결과를 낸다(결정성). 오프라인 상한이 12시간이라
 * 한 정산당 웨이브 수는 240회 이하 — 순차 반복으로 충분하다.
 *
 * 전리품은 stats에 영향을 주지 않으므로 루프 동안 누적했다가 끝에서 한 번에 지급한다.
 * 오프라인 보상 50%는 항상 한 번의 호출이므로 누적 합에 floor를 적용해도 안전하다.
 * XP는 스탯을 바꾸므로 매 웨이브 즉시 지급한다(다음 웨이브 판정에 반영).
 */
export function settleWaves(
  state: GameState,
  spanMs: number,
  gains: Gains,
  offline: boolean,
): void {
  const v = state.village;
  if (v.underSiege) return;

  const budgetMs = v.waveProgressMs + spanMs;
  const waves = Math.floor(budgetMs / WAVE_PERIOD_MS);
  if (waves <= 0) {
    v.waveProgressMs = budgetMs;
    return;
  }

  const tier = currentTier(state);
  const halving = offline ? 0.5 : 1;
  const supply = state.combatFood ? getItem(state.combatFood) : null;
  const heal = supply?.food?.heal ?? 0;

  let wavesWon = 0;
  let defeated = false;
  let damaged: 'wall' | 'barracks' | undefined;

  for (let w = 0; w < waves; w++) {
    const stats = computeVillageStats(state);
    const gross = grossWaveDamage(stats, tier.monsters);
    const regen = regenPerWave(stats);
    const net = Number.isFinite(gross) ? Math.max(0, gross - regen) : Infinity;
    const supplyQty = state.combatFood ? (state.inventory[state.combatFood] ?? 0) : 0;

    // 이번 웨이브를 버틸 수 있나 — HP(1까지) + 보급품으로 net을 흡수
    if (net > 0) {
      const buffer = v.hp - 1 + heal * supplyQty;
      if (!Number.isFinite(net) || net > buffer) {
        defeated = true;
        break;
      }
    }

    // 승리 — 전리품 지급(오프라인이면 확률 절반), XP 즉시 지급(스탯 갱신), HP 정산
    rollWaveLoot(state, gains, tier, halving);
    let hpXp = 0;
    for (const monsterId of tier.monsters) {
      const dmg = damageTakenPerKill(stats, getMonster(monsterId));
      hpXp += hitpointsXpPerKill(Number.isFinite(dmg) ? dmg : 0);
    }
    const attackXpBase = tier.monsters.reduce((sum, id) => sum + getMonster(id).xp, 0);
    grantXp(state, gains, 'attack', Math.round(attackXpBase * tier.rewardMultiplier * halving));
    grantXp(state, gains, 'hitpoints', Math.round(hpXp * tier.rewardMultiplier * halving));

    if (net > 0) {
      const absorbedByHp = Math.min(v.hp - 1, net);
      const supplyUsed =
        heal > 0 ? Math.min(supplyQty, Math.ceil(Math.max(0, net - absorbedByHp) / heal)) : 0;
      if (supplyUsed > 0 && state.combatFood) {
        const left = supplyQty - supplyUsed;
        if (left > 0) state.inventory[state.combatFood] = left;
        else delete state.inventory[state.combatFood];
        gains.itemsConsumed[state.combatFood] =
          (gains.itemsConsumed[state.combatFood] ?? 0) + supplyUsed;
      }
      v.hp = Math.min(stats.maxHp, Math.max(1, v.hp - net + supplyUsed * heal));
    } else {
      const recover = regen - (Number.isFinite(gross) ? gross : 0);
      v.hp = Math.min(stats.maxHp, v.hp + recover);
    }

    v.wavesProcessed += 1;
    wavesWon += 1;
  }

  if (defeated) {
    damaged = damageStructure(v) ?? undefined;
    v.underSiege = true;
    v.waveProgressMs = 0;
  } else {
    v.waveProgressMs = budgetMs - waves * WAVE_PERIOD_MS;
  }

  if (wavesWon > 0 || defeated) {
    const prev = gains.wave;
    gains.wave = {
      wavesWon: (prev?.wavesWon ?? 0) + wavesWon,
      defeated: (prev?.defeated ?? false) || defeated,
      damaged: defeated ? damaged : prev?.damaged,
      wallLevelAfter: defeated ? v.wallLevel : prev?.wallLevelAfter,
    };
  }
}
