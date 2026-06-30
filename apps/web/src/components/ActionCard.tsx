import { activelySupplied, effectiveCycleMs, getItem, type ActionDef } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';
import { GameIcon } from './GameIcon';

export function ActionCard({ action, skillLevel }: { action: ActionDef; skillLevel: number }) {
  const game = useGame((s) => s.game);
  const start = useGame((s) => s.start);
  const stop = useGame((s) => s.stop);

  const { inventory, activeActions } = game;
  const locked = skillLevel < action.levelRequired;
  const activeEntry = activeActions.find((a) => a.actionId === action.id);
  const isActive = activeEntry !== undefined;
  // 버프·도구 업그레이드가 반영된 실제 사이클 시간 기준으로 표시
  const cycleMs = effectiveCycleMs(action, game);
  const boosted = cycleMs < action.durationMs;
  const progressPct = activeEntry ? (activeEntry.progressMs / cycleMs) * 100 : 0;

  // 재료가 부족해도 활성 작업이 공급 중이면 시작 가능 (낚시→요리 조합)
  const missingMaterial = (action.inputs ?? []).some(
    (input) =>
      (inventory[input.itemId] ?? 0) < input.qty &&
      !activelySupplied(game, input.itemId, action.id),
  );

  if (locked) {
    return (
      <div className="action-card locked">
        <div className="action-icon">🔒</div>
        <div className="action-name">{action.name}</div>
        <div className="action-meta">Lv {action.levelRequired} 필요</div>
      </div>
    );
  }

  return (
    <div className={`action-card ${isActive ? 'active' : ''}`}>
      <div className="action-icon"><GameIcon id={action.id} emoji={action.icon} /></div>
      <div className="action-name">{action.name}</div>
      <div className={`action-meta ${boosted ? 'action-boosted' : ''}`}>
        {(cycleMs / 1000).toFixed(1)}초{boosted && ' ⚡'} · {action.xp} XP
      </div>
      <div className="action-meta action-rate">
        시간당 {formatNumber(Math.round((3_600_000 / cycleMs) * action.outputs[0].qty))}개
        · {formatNumber(Math.round((3_600_000 / cycleMs) * action.xp))} XP
      </div>

      {action.inputs && (
        <div className="action-inputs">
          {action.inputs.map((input) => {
            const have = inventory[input.itemId] ?? 0;
            const enough = have >= input.qty;
            return (
              <span key={input.itemId} className={`input-chip ${enough ? '' : 'short'}`}>
                <GameIcon id={input.itemId} emoji={getItem(input.itemId).icon} /> {have}/{input.qty}
              </span>
            );
          })}
        </div>
      )}

      <div className="action-outputs">
        {action.outputs.map((output) => (
          <span key={output.itemId} className="output-chip">
            <GameIcon id={output.itemId} emoji={getItem(output.itemId).icon} /> {getItem(output.itemId).name} ×{output.qty}
          </span>
        ))}
        {action.byproducts?.map((entry) => (
          <span
            key={entry.itemId}
            className="output-chip output-chip-rare"
            title={`${Math.round(entry.chance * 100)}% 확률로 추가 획득`}
          >
            <GameIcon id={entry.itemId} emoji={getItem(entry.itemId).icon} /> {getItem(entry.itemId).name}{' '}
            {Math.round(entry.chance * 100)}%
          </span>
        ))}
      </div>

      <div className="action-progress">
        <span
          className="action-progress-fill"
          style={{ width: `${progressPct}%`, transition: isActive ? 'width 0.2s linear' : 'none' }}
        />
      </div>

      {isActive ? (
        <button className="btn btn-stop" onClick={() => stop(action.id)}>
          중지
        </button>
      ) : (
        <button className="btn" disabled={missingMaterial} onClick={() => start(action.id)}>
          {missingMaterial ? '재료 부족' : '시작'}
        </button>
      )}
    </div>
  );
}
