import { getAction, nextSlotUnlock, totalLevel, unlockedActionSlots } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function TopBar() {
  const gold = useGame((s) => s.game.gold);
  const game = useGame((s) => s.game);
  const stop = useGame((s) => s.stop);

  const slots = unlockedActionSlots(game);
  const next = nextSlotUnlock(game);

  return (
    <header className="topbar">
      <h1 className="topbar-title">⚔️ Idle RPG</h1>
      <div className="topbar-status">
        {game.activeActions.length > 0 ? (
          game.activeActions.map((active) => {
            const action = getAction(active.actionId);
            return (
              <span key={active.actionId} className="topbar-active">
                {action.icon} {action.name}
                <button className="btn btn-small" onClick={() => stop(active.actionId)}>
                  중지
                </button>
              </span>
            );
          })
        ) : (
          <span className="topbar-idle">대기 중</span>
        )}
      </div>
      <div className="topbar-slots" title={next ? `총 레벨 ${next.totalLevel} 달성 시 슬롯 +1 (현재 총 레벨 ${totalLevel(game)})` : '모든 슬롯 해금됨'}>
        슬롯 {game.activeActions.length}/{slots}
        {next && <span className="topbar-slots-hint"> · 총 Lv {next.totalLevel}에 +1</span>}
      </div>
      <div className="topbar-gold">🪙 {formatNumber(gold)}</div>
    </header>
  );
}
