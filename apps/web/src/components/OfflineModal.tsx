import { getAction, getItem, getSkill, type Gains, type SkillId } from '@idle-rpg/core';
import { formatDuration, formatNumber } from '../format';
import { useGame } from '../store';

export function OfflineModal({ gains }: { gains: Gains }) {
  const dismiss = useGame((s) => s.dismissOffline);

  const xpEntries = Object.entries(gains.xp) as [SkillId, number][];
  const itemEntries = Object.entries(gains.itemsGained);
  const levelUpEntries = Object.entries(gains.levelUps) as [SkillId, { from: number; to: number }][];

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>⏰ 오프라인 보상</h2>
        <p className="modal-sub">
          {formatDuration(gains.elapsedMs)} 동안의 진행이 정산되었습니다.
          {gains.discardedMs > 0 && (
            <span className="modal-warn">
              <br />
              (오프라인 진행은 최대 12시간까지 인정됩니다)
            </span>
          )}
        </p>

        {levelUpEntries.length > 0 && (
          <div className="modal-section">
            {levelUpEntries.map(([skillId, lv]) => (
              <div key={skillId} className="modal-levelup">
                🎉 {getSkill(skillId).name} Lv {lv.from} → <strong>Lv {lv.to}</strong>
              </div>
            ))}
          </div>
        )}

        {xpEntries.length > 0 && (
          <div className="modal-section">
            {xpEntries.map(([skillId, xp]) => (
              <div key={skillId}>
                {getSkill(skillId).icon} {getSkill(skillId).name} +{formatNumber(xp)} XP
              </div>
            ))}
          </div>
        )}

        {itemEntries.length > 0 && (
          <div className="modal-section">
            {itemEntries.map(([itemId, qty]) => (
              <div key={itemId}>
                {getItem(itemId).icon} {getItem(itemId).name} ×{formatNumber(qty)}
              </div>
            ))}
          </div>
        )}

        {gains.stopped.map((s) => (
          <p key={s.actionId} className="modal-warn">
            ⚠️ {getAction(s.actionId).name} — 재료가 떨어져 중단되었습니다.
          </p>
        ))}

        <button className="btn btn-primary" onClick={dismiss}>
          확인
        </button>
      </div>
    </div>
  );
}
