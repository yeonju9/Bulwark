import { getAction } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function TopBar() {
  const gold = useGame((s) => s.game.gold);
  const active = useGame((s) => s.game.activeAction);
  const stop = useGame((s) => s.stop);

  const action = active ? getAction(active.actionId) : null;

  return (
    <header className="topbar">
      <h1 className="topbar-title">⚔️ Idle RPG</h1>
      <div className="topbar-status">
        {action ? (
          <span className="topbar-active">
            {action.icon} {action.name} 진행 중
            <button className="btn btn-small" onClick={stop}>
              중지
            </button>
          </span>
        ) : (
          <span className="topbar-idle">대기 중</span>
        )}
      </div>
      <div className="topbar-gold">🪙 {formatNumber(gold)}</div>
    </header>
  );
}
