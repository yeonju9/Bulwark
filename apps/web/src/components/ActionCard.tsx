import { getItem, type ActionDef } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';

export function ActionCard({ action, skillLevel }: { action: ActionDef; skillLevel: number }) {
  const inventory = useGame((s) => s.game.inventory);
  const activeActions = useGame((s) => s.game.activeActions);
  const start = useGame((s) => s.start);
  const stop = useGame((s) => s.stop);

  const locked = skillLevel < action.levelRequired;
  const activeEntry = activeActions.find((a) => a.actionId === action.id);
  const isActive = activeEntry !== undefined;
  const progressPct = activeEntry ? (activeEntry.progressMs / action.durationMs) * 100 : 0;

  const missingMaterial = (action.inputs ?? []).some(
    (input) => (inventory[input.itemId] ?? 0) < input.qty,
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
      <div className="action-icon">{action.icon}</div>
      <div className="action-name">{action.name}</div>
      <div className="action-meta">
        {(action.durationMs / 1000).toFixed(1)}초 · {action.xp} XP
      </div>
      <div className="action-meta action-rate">
        시간당 {formatNumber(Math.round((3_600_000 / action.durationMs) * action.outputs[0].qty))}개
        · {formatNumber(Math.round((3_600_000 / action.durationMs) * action.xp))} XP
      </div>

      {action.inputs && (
        <div className="action-inputs">
          {action.inputs.map((input) => {
            const have = inventory[input.itemId] ?? 0;
            const enough = have >= input.qty;
            return (
              <span key={input.itemId} className={`input-chip ${enough ? '' : 'short'}`}>
                {getItem(input.itemId).icon} {have}/{input.qty}
              </span>
            );
          })}
        </div>
      )}

      <div className="action-outputs">
        {action.outputs.map((output) => (
          <span key={output.itemId} className="output-chip">
            {getItem(output.itemId).icon} {getItem(output.itemId).name} ×{output.qty}
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
