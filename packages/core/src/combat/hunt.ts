import { getItem } from '../data/items';
import { getMonster } from '../data/monsters';
import { lootRollsForKill } from '../rng';
import { levelFromXp } from '../xp';
import {
  computeStats,
  damageTakenPerKill,
  hitpointsXpPerKill,
  HUNT_DOWNTIME_MS,
  timeToKillMs,
} from './stats';
import type { ActionDef, ActiveAction, Gains, GameState, SkillId } from '../types';

/**
 * 사냥 작업 1개를 elapsedMs만큼 정산한다. state를 직접 변형(이미 simulate가 클론한 상태).
 * 반환: 작업이 계속되는지 여부.
 *
 * 모델: 사이클 = 몬스터 1마리 처치(기대값 처치시간 + 탐색시간).
 * 정산 구간 동안 스탯은 시작 시점으로 고정한다(구간 중 레벨업이 있어도 다음 정산부터 반영).
 * 처치 수는 닫힌 식으로 구하고, HP·음식이 버티는 한도로 제한한다.
 */
export function settleHunt(
  state: GameState,
  active: ActiveAction,
  action: ActionDef,
  elapsedMs: number,
  gains: Gains,
): boolean {
  const monster = getMonster(action.combat!.monsterId);
  const stats = computeStats(state);

  const cycleMs = timeToKillMs(stats, monster) + HUNT_DOWNTIME_MS;
  const dmgPerKill = damageTakenPerKill(stats, monster);

  const budgetMs = active.progressMs + elapsedMs;
  let kills = Math.floor(budgetMs / cycleMs);
  let stoppedLowHp = false;

  // HP·음식이 버틸 수 있는 최대 처치 수 (죽기 전에 멈춘다 — 소프트 페널티)
  const foodItem = state.combatFood ? getItem(state.combatFood) : null;
  const heal = foodItem?.food?.heal ?? 0;
  const foodQty = state.combatFood ? (state.inventory[state.combatFood] ?? 0) : 0;
  if (dmgPerKill > 0) {
    const sustainable = Math.floor((state.hp - 1 + heal * foodQty) / dmgPerKill);
    if (kills >= sustainable) {
      kills = Math.max(0, sustainable);
      stoppedLowHp = true;
    }
  }

  if (kills > 0) {
    // 전리품: 몬스터별 전역 처치 순번을 시드로 — 틱 패턴과 무관하게 결정적
    const killsBefore = state.monsterKills[monster.id] ?? 0;
    for (let i = 0; i < kills; i++) {
      const roll = lootRollsForKill(monster.id, killsBefore + i);
      for (const entry of monster.lootTable) {
        if (roll() < entry.chance) {
          state.inventory[entry.itemId] = (state.inventory[entry.itemId] ?? 0) + entry.qty;
          gains.itemsGained[entry.itemId] = (gains.itemsGained[entry.itemId] ?? 0) + entry.qty;
        }
      }
    }
    state.monsterKills[monster.id] = killsBefore + kills;
    gains.kills[monster.id] = (gains.kills[monster.id] ?? 0) + kills;

    // HP·음식 정산
    const totalDamage = dmgPerKill * kills;
    const absorbedByHp = Math.min(state.hp - 1, totalDamage);
    const foodUsed =
      heal > 0 ? Math.min(foodQty, Math.ceil(Math.max(0, totalDamage - absorbedByHp) / heal)) : 0;
    if (foodUsed > 0 && state.combatFood) {
      const left = foodQty - foodUsed;
      if (left > 0) state.inventory[state.combatFood] = left;
      else delete state.inventory[state.combatFood];
      gains.itemsConsumed[state.combatFood] =
        (gains.itemsConsumed[state.combatFood] ?? 0) + foodUsed;
    }
    state.hp = Math.min(stats.maxHp, Math.max(1, state.hp - totalDamage + foodUsed * heal));

    // XP: 공격(처치당) + 체력(받은 피해 비례)
    grantXp(state, gains, 'attack', monster.xp * kills);
    grantXp(state, gains, 'hitpoints', hitpointsXpPerKill(dmgPerKill) * kills);
  }

  if (stoppedLowHp) {
    gains.stopped.push({ actionId: action.id, reason: 'low-hp' });
    return false;
  }
  active.progressMs = budgetMs - kills * cycleMs;
  return true;
}

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
