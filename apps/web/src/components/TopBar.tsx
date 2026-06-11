import {
  computeStats,
  getAction,
  nextSlotUnlock,
  totalLevel,
  unlockedActionSlots,
} from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function TopBar() {
  const gold = useGame((s) => s.game.gold);
  const game = useGame((s) => s.game);
  const stop = useGame((s) => s.stop);

  const slots = unlockedActionSlots(game);
  const next = nextSlotUnlock(game);
  const stats = computeStats(game);

  return (
    <header className="topbar">
      <h1 className="topbar-title">❄️ Winterforge</h1>
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
      <div
        className="topbar-slots"
        title={
          next
            ? `총 레벨(모든 스킬 레벨의 합)이 ${next.totalLevel}이 되면 작업 슬롯 +1`
            : '모든 작업 슬롯을 해금했습니다'
        }
      >
        슬롯 {game.activeActions.length}/{slots}
        <span className="topbar-slots-hint">
          {next ? ` · 총 Lv ${totalLevel(game)}/${next.totalLevel}` : ` · 총 Lv ${totalLevel(game)}`}
        </span>
      </div>
      <div className="topbar-hp" title="HP — 사냥 중이 아닐 때 자연 회복됩니다">
        ❤️ {Math.floor(game.hp)}/{stats.maxHp}
      </div>
      <div className="topbar-gold">🪙 {formatNumber(gold)}</div>
    </header>
  );
}
