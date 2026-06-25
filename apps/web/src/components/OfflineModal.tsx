import { getItem, getMonster, getSkill, type Gains, type SkillId } from '@idle-rpg/core';
import { formatDuration, formatNumber } from '../format';
import { stoppedActionText, useGame } from '../store';

export function OfflineModal({ gains }: { gains: Gains }) {
  const dismiss = useGame((s) => s.dismissOffline);

  const xpEntries = Object.entries(gains.xp) as [SkillId, number][];
  const itemEntries = Object.entries(gains.itemsGained);
  const levelUpEntries = Object.entries(gains.levelUps) as [SkillId, { from: number; to: number }][];
  const killEntries = Object.entries(gains.kills);

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
          <br />
          <span className="settings-desc">오프라인 웨이브 보상은 50%로 정산됩니다.</span>
        </p>

        {gains.wave && (
          <div className="modal-section">
            <div>
              🛡️ 웨이브 {formatNumber(gains.wave.wavesWon)}회 방어
              {gains.wave.goldWon > 0 && <> · 🪙 {formatNumber(gains.wave.goldWon)}</>}
            </div>
            {gains.wave.defeated && (
              <div className="modal-warn">
                마을이 함락되어 농성에 들어갔습니다
                {gains.wave.damaged === 'wall'
                  ? ' — 성벽이 한 단계 무너졌습니다'
                  : gains.wave.damaged === 'barracks'
                    ? ' — 병영이 파손되었습니다'
                    : ''}
              </div>
            )}
          </div>
        )}

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

        {killEntries.length > 0 && (
          <div className="modal-section">
            {killEntries.map(([monsterId, count]) => (
              <div key={monsterId}>
                {getMonster(monsterId).icon} {getMonster(monsterId).name} {formatNumber(count)}마리
                처치
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
            {stoppedActionText(s)}
          </p>
        ))}

        <button className="btn btn-primary" onClick={dismiss}>
          확인
        </button>
      </div>
    </div>
  );
}
