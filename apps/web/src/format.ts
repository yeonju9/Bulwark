import { getSkill, type ItemDef } from '@idle-rpg/core';

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function potionEffectText(potion: NonNullable<ItemDef['potion']>): string {
  const parts: string[] = [];
  const { cycleTime, attack, defense } = potion.effect;
  if (cycleTime) {
    parts.push(
      `${getSkill(cycleTime.skillId).name} 속도 +${Math.round((1 - cycleTime.multiplier) * 100)}%`,
    );
  }
  if (attack) parts.push(`공격 +${Math.round((attack - 1) * 100)}%`);
  if (defense) parts.push(`방어 +${Math.round((defense - 1) * 100)}%`);
  return `${parts.join(' · ')} (${Math.round(potion.durationMs / 60_000)}분)`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
