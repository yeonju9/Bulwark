import { actionsForSkill, getSkill, xpProgress, type SkillId } from '@idle-rpg/core';
import { formatNumber } from '../format';
import { useGame } from '../store';
import { ActionCard } from './ActionCard';

export function SkillPanel({ skillId }: { skillId: SkillId }) {
  const xp = useGame((s) => s.game.skills[skillId].xp);
  const skill = getSkill(skillId);
  const { level, into, needed } = xpProgress(xp);
  const pct = needed > 0 ? (into / needed) * 100 : 100;

  return (
    <div className="skill-panel">
      <div className="skill-header">
        <h2>
          {skill.icon} {skill.name} <span className="skill-header-level">Lv {level} / 99</span>
        </h2>
        <p className="skill-desc">{skill.description}</p>
        <div className="xp-bar xp-bar-large">
          <span className="xp-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="xp-text">
          {needed > 0 ? `다음 레벨까지 ${formatNumber(needed - into)} XP` : '최고 레벨'}
        </span>
      </div>
      <div className="action-grid">
        {actionsForSkill(skillId).map((action) => (
          <ActionCard key={action.id} action={action} skillLevel={level} />
        ))}
      </div>
    </div>
  );
}
