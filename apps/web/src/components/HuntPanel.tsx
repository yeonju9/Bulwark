import {
  computeStats,
  damageTakenPerKill,
  getItem,
  huntableMonsters,
  HUNT_DOWNTIME_MS,
  timeToKillMs,
  xpProgress,
} from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function HuntPanel() {
  const game = useGame((s) => s.game);
  const start = useGame((s) => s.start);
  const stop = useGame((s) => s.stop);

  const stats = computeStats(game);
  const { level, into, needed } = xpProgress(game.skills.attack.xp);
  const pct = needed > 0 ? (into / needed) * 100 : 100;
  const activeHunt = game.activeActions.find((a) => a.skillId === 'attack');

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>
          ⚔️ 사냥터 <span className="skill-header-level">공격 Lv {level} / 99</span>
        </h2>
        <p className="skill-desc">
          몬스터를 사냥해 공격·체력 경험치와 전리품을 얻습니다. 받는 피해를 음식과 HP로 버틸 수
          있어야 합니다.
        </p>
        <div className="xp-bar xp-bar-large">
          <span className="xp-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="action-grid">
        {huntableMonsters().map((monster) => {
          const locked = level < monster.levelRequired;
          if (locked) {
            return (
              <div key={monster.id} className="action-card locked">
                <div className="action-icon">🔒</div>
                <div className="action-name">{monster.name}</div>
                <div className="action-meta">공격 Lv {monster.levelRequired} 필요</div>
              </div>
            );
          }

          const actionId = `hunt_${monster.id}`;
          const isActive = activeHunt?.actionId === actionId;
          const ttk = timeToKillMs(stats, monster);
          const cycle = ttk + HUNT_DOWNTIME_MS;
          const damage = damageTakenPerKill(stats, monster);
          const dangerPct = (damage / stats.maxHp) * 100;
          const danger = dangerPct >= 25 ? 'danger' : dangerPct >= 8 ? 'caution' : 'safe';
          const dangerLabel =
            danger === 'danger' ? '⛔ 위험' : danger === 'caution' ? '⚠️ 주의' : '✅ 안전';
          const xpPerHour = Math.round((3_600_000 / cycle) * monster.xp);
          const progressPct = isActive && activeHunt ? (activeHunt.progressMs / cycle) * 100 : 0;

          return (
            <div key={monster.id} className={`action-card ${isActive ? 'active' : ''}`}>
              <div className="action-icon">{monster.icon}</div>
              <div className="action-name">{monster.name}</div>
              <div className="action-meta">
                HP {monster.hp} · 공격 {monster.attack} · 방어 {monster.defense}
              </div>
              <div className="action-meta">
                처치 {(cycle / 1000).toFixed(1)}초 · 피해 {damage}/마리
              </div>
              <div className="action-meta action-rate">
                시간당 {formatNumber(xpPerHour)} XP
              </div>
              <div className={`danger-badge ${danger}`}>{dangerLabel}</div>
              <div className="action-outputs">
                {monster.lootTable.map((loot) => (
                  <span key={loot.itemId} className="output-chip">
                    {getItem(loot.itemId).icon} {getItem(loot.itemId).name}{' '}
                    {Math.round(loot.chance * 100)}%
                  </span>
                ))}
              </div>
              <div className="action-progress">
                <span
                  className="action-progress-fill"
                  style={{
                    width: `${Math.min(100, progressPct)}%`,
                    transition: isActive ? 'width 0.2s linear' : 'none',
                  }}
                />
              </div>
              {isActive ? (
                <button className="btn btn-stop" onClick={() => stop(actionId)}>
                  사냥 중지
                </button>
              ) : (
                <button className="btn" onClick={() => start(actionId)}>
                  사냥 시작
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
