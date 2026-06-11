export const MAX_LEVEL = 99;

/** xpTable[n - 1] = 레벨 n이 되기 위한 누적 경험치 (RuneScape 곡선) */
const xpTable: number[] = (() => {
  const table = [0];
  let points = 0;
  for (let lv = 1; lv < MAX_LEVEL; lv++) {
    points += Math.floor(lv + 300 * Math.pow(2, lv / 7));
    table.push(Math.floor(points / 4));
  }
  return table;
})();

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return xpTable[MAX_LEVEL - 1];
  return xpTable[level - 1];
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpTable[level]) level++;
  return level;
}

/** 현재 레벨 내 진행도. UI 경험치 바에 사용 */
export function xpProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0 };
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - cur, needed: next - cur };
}
