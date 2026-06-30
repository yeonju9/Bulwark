import {
  computeVillageStats,
  getAction,
  getItem,
  nextSlotUnlock,
  totalLevel,
  unlockedActionSlots,
} from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';
import { useWavePulse } from '../useWavePulse';
import { GameIcon } from './GameIcon';

function remainingText(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}초`;
}

export function TopBar() {
  const gold = useGame((s) => s.game.gold);
  const game = useGame((s) => s.game);
  const stop = useGame((s) => s.stop);

  const slots = unlockedActionSlots(game);
  const next = nextSlotUnlock(game);
  const stats = computeVillageStats(game);
  const wavePulse = useWavePulse();

  return (
    <header className="topbar">
      <h1 className="topbar-title">🛡️ Bulwark</h1>
      <div className="topbar-status">
        {game.activeActions.length > 0 ? (
          game.activeActions.map((active) => {
            const action = getAction(active.actionId);
            return (
              <span key={active.actionId} className="topbar-active">
                <span className="topbar-active-label">
                  <GameIcon id={active.actionId} emoji={action.icon} /> {action.name}
                </span>
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
      {game.buffs.length > 0 && (
        <div className="topbar-buffs">
          {game.buffs.map((buff) => {
            const item = getItem(buff.itemId);
            return (
              <span
                key={buff.category}
                className="buff-chip"
                title={`${item.name} — 남은 시간 ${remainingText(buff.expiresAtMs - game.lastTickAt)}`}
              >
                <GameIcon id={buff.itemId} emoji={item.icon} /> {remainingText(buff.expiresAtMs - game.lastTickAt)}
              </span>
            );
          })}
        </div>
      )}
      <div
        className={`topbar-hp ${game.village.underSiege ? 'sieged' : ''} ${wavePulse ? 'shake' : ''}`}
        title={game.village.underSiege ? '마을이 농성 중 — 수리/강화로 방어 재개' : '마을 HP — 웨이브 사이에 자연 회복됩니다'}
      >
        {game.village.underSiege ? '🛡️' : '❤️'} {Math.floor(game.village.hp)}/{stats.maxHp}
      </div>
      <div className="topbar-gold">🪙 {formatNumber(gold)}</div>
    </header>
  );
}
