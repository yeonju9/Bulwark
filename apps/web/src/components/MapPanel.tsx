import {
  allDungeons,
  buildableBuildings,
  computeVillageStats,
  currentStage,
  currentTier,
  estimateInvasion,
  getBuilding,
  getItem,
  getMonster,
  MAX_WALL_LEVEL,
  repairCost,
  unlockedTier,
  wallReinforceCost,
  wallStats,
  type BuildingId,
  type DungeonId,
  type EquipSlot,
  type ItemId,
  type MonsterId,
} from '@idle-rpg/core';
import { useMemo, useState, type CSSProperties } from 'react';
import { formatNumber } from '../format';
import { iconUrl } from '../icons';
import { useGame, type SiegeFloatingHit } from '../store';
import { useInvasionPhase, useWavePulse } from '../useWavePulse';
import { GameIcon } from './GameIcon';

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: '무기', armor: '방어구' };

// 던전 네 모서리 배치
const DUNGEON_POS = [
  { top: '11%', left: '3%' },
  { top: '11%', right: '3%' },
  { bottom: '6%', left: '3%' },
  { bottom: '6%', right: '3%' },
] as const;

// 1단계 "시작의 마을" 풍경(흙길+연못) — 목업 buildScenery('s1') 포팅
const SCENERY_S1 = `<svg viewBox="0 0 1000 600" preserveAspectRatio="none">
<ellipse cx="240" cy="440" rx="130" ry="48" fill="rgba(255,255,255,.06)"/>
<ellipse cx="780" cy="180" rx="120" ry="44" fill="rgba(0,0,0,.05)"/>
<path d="M500,300 Q300,250 150,150" stroke="#a8865a" stroke-width="22" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M500,300 Q700,250 850,150" stroke="#a8865a" stroke-width="22" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M500,300 Q300,360 160,470" stroke="#a8865a" stroke-width="22" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M500,300 Q700,360 840,470" stroke="#a8865a" stroke-width="22" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M500,300 Q300,250 150,150" stroke="#c9ab78" stroke-width="14" fill="none" stroke-linecap="round"/>
<path d="M500,300 Q700,250 850,150" stroke="#c9ab78" stroke-width="14" fill="none" stroke-linecap="round"/>
<path d="M500,300 Q300,360 160,470" stroke="#c9ab78" stroke-width="14" fill="none" stroke-linecap="round"/>
<path d="M500,300 Q700,360 840,470" stroke="#c9ab78" stroke-width="14" fill="none" stroke-linecap="round"/>
<defs><radialGradient id="pond" cx="44%" cy="36%" r="78%">
<stop offset="0%" stop-color="#d2ecf5"/><stop offset="50%" stop-color="#8fc3dc"/><stop offset="100%" stop-color="#5d9bbf"/></radialGradient></defs>
<path d="M598,456 C598,414 696,396 730,401 C798,408 836,430 831,459 C826,494 742,514 694,509 C640,504 598,491 598,456 Z" fill="#aec188" opacity=".5"/>
<path d="M610,453 C610,417 698,402 729,407 C789,413 821,432 817,457 C813,488 740,504 700,500 C651,496 610,482 610,453 Z" fill="url(#pond)" stroke="#5d96b4" stroke-width="3"/>
<ellipse cx="706" cy="448" rx="44" ry="13" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>
<ellipse cx="708" cy="458" rx="68" ry="21" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
<ellipse cx="672" cy="472" rx="17" ry="8" fill="#5aa657"/><path d="M672,472 L661,468" stroke="#3f7d3f" stroke-width="2"/>
<ellipse cx="754" cy="441" rx="13" ry="6" fill="#6cb968"/>
<circle cx="690" cy="447" r="5.5" fill="#f3a8c3"/><circle cx="690" cy="447" r="2.2" fill="#fff2c2"/>
<g stroke="#6f8a3a" stroke-width="3" stroke-linecap="round"><line x1="626" y1="432" x2="622" y2="408"/><line x1="635" y1="434" x2="639" y2="406"/><line x1="645" y1="432" x2="647" y2="413"/></g>
<rect x="620" y="404" width="6" height="11" rx="3" fill="#7a5a2a"/><rect x="636" y="400" width="6" height="11" rx="3" fill="#7a5a2a"/>
</svg>`;

// 1단계 장식 이모지 {emoji, top, left, size(px), opacity?}
const DECOS_S1: { e: string; top: string; left: string; size: number; op?: number }[] = [
  { e: '🌳', top: '55%', left: '11%', size: 42 }, { e: '🌳', top: '71%', left: '85%', size: 40 }, { e: '🌲', top: '17%', left: '80%', size: 34 },
  { e: '🌳', top: '12%', left: '19%', size: 30, op: 0.95 }, { e: '🌲', top: '30%', left: '63%', size: 17, op: 0.8 }, { e: '🌳', top: '22%', left: '45%', size: 15, op: 0.72 },
  { e: '🌷', top: '77%', left: '29%', size: 18 }, { e: '🌼', top: '85%', left: '57%', size: 17 }, { e: '🌻', top: '47%', left: '89%', size: 18 },
  { e: '🍄', top: '65%', left: '17%', size: 15 }, { e: '🌿', top: '40%', left: '24%', size: 16, op: 0.9 }, { e: '🌾', top: '73%', left: '65%', size: 18 },
  { e: '🐑', top: '90%', left: '40%', size: 23 }, { e: '🐇', top: '83%', left: '24%', size: 16 }, { e: '🦆', top: '77%', left: '69%', size: 17 },
];

// 떠다니는 꽃가루 입자 + 나비 (1단계)
const PARTICLES = [8, 22, 37, 53, 69, 84, 93, 30, 62].map((left, k) => ({
  left,
  top: 18 + ((k * 9) % 70),
  dur: [10, 12, 9, 13, 11, 10, 14, 12, 11][k],
  delay: [0, 1.6, 3.2, 0.8, 2.4, 4.4, 1.1, 3.6, 5.2][k],
}));
const BUTTERFLIES = [
  { top: '20%', left: '28%', delay: '0s' },
  { top: '62%', left: '58%', delay: '3.5s' },
];

// 손그림 건물 아트 (테마색 --ink/--accent 따라감) — 목업 BUILDINGS 포팅
const HQ_ART =
  '<svg viewBox="0 0 100 104" width="80" style="color:var(--ink)">' +
  '<line x1="50" y1="4" x2="50" y2="22" stroke="currentColor" stroke-width="2.5"/>' +
  '<path d="M50 6 L66 10 L50 15 Z" style="fill:var(--accent)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<path d="M17 49 L34 21 L66 21 L83 49 Z" style="fill:var(--accent)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<circle cx="50" cy="36" r="6.5" fill="#f4ecd6" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M50 36 L50 31 M50 36 L53.5 38" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>' +
  '<rect x="24" y="49" width="52" height="45" rx="3" fill="#f4ecd6" stroke="currentColor" stroke-width="2.5"/>' +
  '<rect x="29" y="60" width="11" height="13" rx="1.5" fill="#ffd27a" stroke="currentColor" stroke-width="2"/>' +
  '<rect x="60" y="60" width="11" height="13" rx="1.5" fill="#ffd27a" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M43 94 L43 74 Q50 67 57 74 L57 94 Z" fill="#7a5330" stroke="currentColor" stroke-width="2"/>' +
  '<rect x="20" y="92" width="60" height="6" rx="2" fill="#cdbf9c" stroke="currentColor" stroke-width="2"/></svg>';
const BARRACKS_ART =
  '<svg viewBox="0 0 100 104" width="66" style="color:var(--ink)">' +
  '<rect x="12" y="40" width="20" height="54" fill="#ddd6c4" stroke="currentColor" stroke-width="2.5"/>' +
  '<rect x="19" y="52" width="5" height="10" fill="#3a2c1c"/>' +
  '<rect x="30" y="50" width="58" height="44" fill="#f4ecd6" stroke="currentColor" stroke-width="2.5"/>' +
  '<rect x="51" y="55" width="16" height="20" rx="1" style="fill:var(--accent)" stroke="currentColor" stroke-width="2"/>' +
  '<line x1="59" y1="59" x2="59" y2="71" stroke="#f4ecd6" stroke-width="2"/><line x1="55" y1="63" x2="63" y2="63" stroke="#f4ecd6" stroke-width="2"/>' +
  '<rect x="37" y="60" width="4" height="11" fill="#3a2c1c"/><rect x="77" y="60" width="4" height="11" fill="#3a2c1c"/>' +
  '<path d="M52 94 L52 80 Q59 74 66 80 L66 94 Z" fill="#5a3f24" stroke="currentColor" stroke-width="2"/>' +
  '<rect x="10" y="92" width="82" height="6" rx="2" fill="#c7b896" stroke="currentColor" stroke-width="2"/></svg>';
const BROKEN_ART =
  '<svg viewBox="0 0 100 104" width="66" style="color:var(--ink)">' +
  '<circle cx="70" cy="40" r="5" fill="#b8b0a6" opacity=".75"/><circle cx="77" cy="34" r="4" fill="#c8c0b6" opacity=".7"/><circle cx="65" cy="34" r="3.5" fill="#cfc8be" opacity=".6"/>' +
  '<rect x="12" y="42" width="20" height="52" fill="#ddd6c4" stroke="currentColor" stroke-width="2.5"/>' +
  '<path d="M30 50 L52 50 L55 45 L60 52 L66 46 L72 53 L88 51 L88 94 L30 94 Z" fill="#f4ecd6" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<rect x="38" y="60" width="14" height="16" rx="1" style="fill:var(--accent)" stroke="currentColor" stroke-width="2" transform="rotate(-7 45 68)"/>' +
  '<rect x="10" y="92" width="82" height="6" rx="2" fill="#c7b896" stroke="currentColor" stroke-width="2"/></svg>';

const BUILDING_ART: Partial<Record<BuildingId, string>> = {
  headquarters: HQ_ART,
  barracks: BARRACKS_ART,
};

/** 칸에 올라간 건물 그림: 사용자 아이콘 > 손그림 SVG > 이모지 순으로 폴백 */
function BuildingVisual({ id, emoji, damaged }: { id: BuildingId; emoji: string; damaged: boolean }) {
  if (damaged) {
    const url = iconUrl(`${id}_broken`) ?? iconUrl(id);
    if (url) return <img className="game-icon" src={url} alt="" style={{ width: 54, height: 54 }} draggable={false} />;
    return <span dangerouslySetInnerHTML={{ __html: BROKEN_ART }} />;
  }
  const url = iconUrl(id);
  if (url) return <img className="game-icon" src={url} alt="" style={{ width: 54, height: 54 }} draggable={false} />;
  const art = BUILDING_ART[id];
  if (art) return <span dangerouslySetInnerHTML={{ __html: art }} />;
  return <>{emoji}</>;
}

function timerText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function costChips(gold: number, items: { itemId: ItemId; qty: number }[]) {
  return (
    <>
      {items.map((it) => (
        <span key={it.itemId} className="chip cost">
          <GameIcon id={it.itemId} emoji={getItem(it.itemId).icon} /> {getItem(it.itemId).name} ×{it.qty}
        </span>
      ))}
      <span className="chip cost">🪙 {formatNumber(gold)}</span>
    </>
  );
}

type Selection =
  | { kind: 'none' }
  | { kind: 'wave' }
  | { kind: 'wall' }
  | { kind: 'cell'; index: number }
  | { kind: 'dungeon'; id: DungeonId };

export function MapPanel() {
  const game = useGame((s) => s.game);
  const build = useGame((s) => s.build);
  const reinforce = useGame((s) => s.reinforce);
  const repair = useGame((s) => s.repair);
  const selectTier = useGame((s) => s.selectTier);
  const enterDungeon = useGame((s) => s.enterDungeon);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const setFood = useGame((s) => s.setFood);

  const [sel, setSel] = useState<Selection>({ kind: 'none' });
  const wavePulse = useWavePulse();
  const phase = useInvasionPhase();
  const siegeHits = useGame((s) => s.siegeHits);

  const v = game.village;
  const stats = computeVillageStats(game);
  const stage = currentStage(game);
  const tier = currentTier(game);
  const maxTier = unlockedTier(game);
  const dungeons = allDungeons();

  const wall = wallStats(v.wallLevel);
  const wallCost = wallReinforceCost(v.wallLevel);

  const equippables = Object.keys(game.inventory).filter((id) => getItem(id).equip) as ItemId[];
  const foods = Object.keys(game.inventory).filter((id) => getItem(id).food) as ItemId[];

  return (
    <div className="skill-panel map-panel">
      <div className="map-screen">
        {/* 웨이브 배너 */}
        <div
          className={`wave-banner ${sel.kind === 'wave' ? 'sel' : ''} ${wavePulse ? 'flash' : ''} ${phase.invading ? 'invading' : ''}`}
          onClick={() => setSel({ kind: 'wave' })}
        >
          <span className="wb-icon">🌊</span>
          {v.underSiege ? (
            <span className="wb-title">마을 농성 중 — 수리·강화로 방어 재개</span>
          ) : phase.invading ? (
            <span className="wb-title wb-invading">
              ⚔️ 웨이브 #{v.wavesProcessed + 1} 침공 중! 격퇴까지{' '}
              <span className="wb-timer">{timerText(phase.remainingMs)}</span>
            </span>
          ) : (
            <span className="wb-title">
              웨이브 #{v.wavesProcessed + 1} 침공까지{' '}
              <span className="wb-timer">{timerText(phase.remainingMs)}</span>
            </span>
          )}
          <span className="wb-spacer" />
          <span className="tier-select" onClick={(e) => e.stopPropagation()}>
            난이도
            {stage.tiers.map((t) => {
              const locked = t.tier > maxTier;
              return (
                <button
                  key={t.tier}
                  className={`tier-opt ${t.tier === tier.tier ? 'sel' : ''} ${locked ? 'lock' : ''}`}
                  onClick={() => selectTier(t.tier)}
                  title={locked ? '던전을 더 클리어하면 해금됩니다' : `${t.name} · 보상 ×${t.rewardMultiplier}`}
                >
                  {locked ? '🔒' : `T${t.tier}`}
                </button>
              );
            })}
          </span>
          {v.underSiege ? (
            <span className="wb-siege">🛡️ 농성</span>
          ) : (
            <span className="wb-mult">보상 ×{tier.rewardMultiplier}</span>
          )}
        </div>

        {/* 마을 HP 바 — 침공 중 실시간으로 깎이는 게 보인다 */}
        <div
          className={`village-hp-bar ${phase.invading ? 'under-attack' : ''} ${v.underSiege ? 'sieged' : ''}`}
          title="마을 HP — 침공 중 몬스터 타격마다 깎이고, 잔잔 구간에 자연 회복됩니다"
        >
          <span
            className="vhp-fill"
            style={{ width: `${Math.max(0, Math.min(100, (v.hp / Math.max(1, stats.maxHp)) * 100))}%` }}
          />
          <span className="vhp-label">
            {v.underSiege ? '🛡️' : '❤️'} 마을 HP {Math.floor(v.hp)} / {stats.maxHp}
          </span>
        </div>

        {/* 맵 프레임 */}
        <div className="map-frame">
          <div className="scenery" dangerouslySetInnerHTML={{ __html: SCENERY_S1 }} />
          <div className="map-title">{stage.stage}단계 — {stage.name}</div>
          <div className="stage-flag">STAGE {stage.stage}</div>

          {/* 입자 + 나비 */}
          <div className="particles">
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className="pt"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  background: 'rgba(255,250,205,.9)',
                  animationDuration: `${p.dur}s`,
                  animationDelay: `${p.delay}s`,
                }}
              />
            ))}
            {BUTTERFLIES.map((b, i) => (
              <span key={i} className="bfly" style={{ top: b.top, left: b.left, animationDelay: b.delay }}>
                🦋
              </span>
            ))}
          </div>

          {/* 장식 */}
          {DECOS_S1.map((d, i) => (
            <span key={i} className="deco" style={{ top: d.top, left: d.left, fontSize: `${d.size}px`, opacity: d.op }}>
              {d.e}
            </span>
          ))}

          {/* 던전 (네 모서리) */}
          {dungeons.slice(0, 4).map((dungeon, idx) => {
            const clears = game.dungeonClears[dungeon.id] ?? 0;
            const first = clears === 0;
            return (
              <div
                key={dungeon.id}
                className={`dungeon ${sel.kind === 'dungeon' && sel.id === dungeon.id ? 'sel' : ''}`}
                style={DUNGEON_POS[idx]}
                onClick={() => setSel({ kind: 'dungeon', id: dungeon.id })}
              >
                <div className="d-icon"><GameIcon id={dungeon.id} emoji={dungeon.icon} size={32} /></div>
                <div className="d-card">
                  {dungeon.name} <span className="d-lv">Lv {dungeon.level}</span>
                  <br />
                  <span className={`badge ${first ? 'first' : ''}`}>
                    {first ? '★ 최초 보상!' : `✔ 클리어 ×${clears}`}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 마을: 성벽 링 + 3×3 */}
          <div className="village">
            <div className="keep">
              <div className="rampart" />
              <span className="tower tl" /><span className="tower tr" />
              <span className="tower bl" /><span className="tower br" />
              <span className="flag">🚩</span>
              <div className="gate" />
              <span
                className={`wall-tag ${sel.kind === 'wall' ? 'sel' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSel({ kind: 'wall' });
                }}
              >
                🧱 성벽 Lv {v.wallLevel}
              </span>

              <div className="village-grid">
                {v.buildings.map((slot, i) => {
                  const selected = sel.kind === 'cell' && sel.index === i;
                  if (!slot) {
                    return (
                      <div
                        key={i}
                        className={`plot empty ${selected ? 'sel' : ''}`}
                        onClick={() => setSel({ kind: 'cell', index: i })}
                      >
                        <div className="lot">
                          <span className="pi">➕</span>
                          <span className="pl">빈 터</span>
                        </div>
                      </div>
                    );
                  }
                  const def = getBuilding(slot.id);
                  return (
                    <div
                      key={i}
                      className={`plot ${slot.damaged ? 'broken' : ''} ${selected ? 'sel' : ''}`}
                      onClick={() => setSel({ kind: 'cell', index: i })}
                    >
                      <div className="ring" />
                      <div className="ground" />
                      <div className="bldg">
                        <BuildingVisual id={slot.id} emoji={def.icon} damaged={slot.damaged} />
                      </div>
                      <div className="tag">
                        {def.name}
                        {slot.damaged ? ' ⚠️' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 실시간 침공 — 몬스터들이 천천히 다가오고, 코어의 실제 피해만 데미지 숫자로 뜬다 */}
          {phase.invading && !v.underSiege && (
            <InvasionLayer monsters={tier.monsters} hits={siegeHits} />
          )}

          <div className="atmo">
            <div className="sun" />
            <div className="vignette" />
          </div>
        </div>

        {/* 상세 패널 — 선택에 따라 내용 전환 */}
        <div className="detail">
          <DetailContent
            sel={sel}
            game={game}
            stage={stage}
            tier={tier}
            stats={stats}
            wall={wall}
            wallCost={wallCost}
            reinforce={reinforce}
            build={build}
            repair={repair}
            enterDungeon={enterDungeon}
          />
        </div>
      </div>

      {/* 맵 아래 기능 섹션: 장비 + 보급품 */}
      <div className="map-extra">
        <section className="settings-section">
          <h3>🛡️ 마을 장비</h3>
          <p className="settings-desc">무기는 마을 공격력, 방어구는 마을 방어력에 더해집니다.</p>
          {(Object.keys(SLOT_LABEL) as EquipSlot[]).map((slot) => {
            const equipped = game.equipment[slot];
            const item = equipped ? getItem(equipped) : null;
            return (
              <div key={slot} className="equip-row">
                <span className="equip-slot-label">{SLOT_LABEL[slot]}</span>
                {item ? (
                  <>
                    <span className="equip-item">
                      <GameIcon id={item.id} emoji={item.icon} /> {item.name}
                      <span className="equip-stat">
                        {item.equip!.attack ? ` 공격 +${item.equip!.attack}` : ''}
                        {item.equip!.defense ? ` 방어 +${item.equip!.defense}` : ''}
                      </span>
                    </span>
                    <button className="btn btn-small" onClick={() => unequip(slot)}>해제</button>
                  </>
                ) : (
                  <span className="equip-empty">비어 있음</span>
                )}
              </div>
            );
          })}
          {equippables.map((id) => {
            const item = getItem(id);
            const req = item.equip!.levelRequired ?? 1;
            const canEquip = stats.attackLevel >= req;
            return (
              <div key={id} className="equip-row">
                <span className="equip-item">
                  <GameIcon id={item.id} emoji={item.icon} /> {item.name} ×{game.inventory[id]}
                  <span className="equip-stat">
                    {item.equip!.attack ? ` 공격 +${item.equip!.attack}` : ''}
                    {item.equip!.defense ? ` 방어 +${item.equip!.defense}` : ''}
                    {req > 1 ? ` (공격 Lv ${req})` : ''}
                  </span>
                </span>
                <button className="btn btn-small" disabled={!canEquip} onClick={() => equip(id)}>장착</button>
              </div>
            );
          })}
        </section>

        <section className="settings-section">
          <h3>🍱 보급품</h3>
          <p className="settings-desc">웨이브 방어 중 마을 HP가 떨어지면 자동으로 소비해 복구합니다.</p>
          <div className="equip-row">
            <span className="equip-slot-label">지정됨</span>
            {game.combatFood ? (
              <>
                <span className="equip-item">
                  <GameIcon id={game.combatFood} emoji={getItem(game.combatFood).icon} /> {getItem(game.combatFood).name} ×
                  {formatNumber(game.inventory[game.combatFood] ?? 0)}
                  <span className="equip-stat"> 회복 +{getItem(game.combatFood).food!.heal}</span>
                </span>
                <button className="btn btn-small" onClick={() => setFood(null)}>해제</button>
              </>
            ) : (
              <span className="equip-empty">없음</span>
            )}
          </div>
          {foods
            .filter((id) => id !== game.combatFood)
            .map((id) => {
              const item = getItem(id);
              return (
                <div key={id} className="equip-row">
                  <span className="equip-item">
                    <GameIcon id={item.id} emoji={item.icon} /> {item.name} ×{formatNumber(game.inventory[id] ?? 0)}
                    <span className="equip-stat"> 회복 +{item.food!.heal}</span>
                  </span>
                  <button className="btn btn-small" onClick={() => setFood(id)}>지정</button>
                </div>
              );
            })}
        </section>
      </div>
    </div>
  );
}

/** 한 침공 몬스터의 진입 경로(가장자리 스폰 → 마을 벽). 매 진입마다 랜덤하게 다시 뽑는다. */
function randomPath(): { sx: number; sy: number; ex: number; ey: number } {
  const ang = Math.random() * Math.PI * 2;
  const r0 = 45 + Math.random() * 8; // 가장자리(랜덤)
  const r1 = 12 + Math.random() * 5; // 마을 벽 근처(랜덤)
  return {
    sx: 50 + Math.cos(ang) * r0,
    sy: 50 + Math.sin(ang) * r0,
    ex: 50 + Math.cos(ang) * r1,
    ey: 50 + Math.sin(ang) * r1,
  };
}

/**
 * 침공 몬스터 한 마리 — 랜덤 위치에서 자기 속도(dur)로 마을을 향해 **천천히** 다가온다(위협적).
 * 마을 벽에 닿으면 그 자리에서 사라지고, 보이지 않게 새 랜덤 위치로 리셋해 다시 다가온다.
 * (데미지 숫자는 몬스터가 아니라 코어의 실제 피해 이벤트로만 뜬다 — InvasionLayer에서 처리)
 */
function Attacker({ monsterId, dur, delay }: { monsterId: MonsterId; dur: number; delay: number }) {
  const [path, setPath] = useState(randomPath);
  const style = {
    '--sx': `${path.sx}%`,
    '--sy': `${path.sy}%`,
    '--ex': `${path.ex}%`,
    '--ey': `${path.ey}%`,
    animationDuration: `${dur}s`,
    animationDelay: `${delay}s`,
  } as CSSProperties;
  return (
    <span
      className="attacker"
      style={style}
      onAnimationIteration={(e) => {
        // 한 바퀴(진입→소멸) 끝나는 순간(화면 밖) 새 랜덤 경로로 — 매번 다른 위치에서 등장
        if (e.target === e.currentTarget) setPath(randomPath());
      }}
    >
      <GameIcon id={monsterId} emoji={getMonster(monsterId).icon} size={34} />
    </span>
  );
}

/**
 * 실시간 침공 레이어 — 소수(4)의 몬스터가 제각기 랜덤 위치·속도로 마을을 향해 **천천히** 다가온다(시차 등장).
 * 데미지 숫자는 **코어의 실제 피해 이벤트(hits)만** 마을 벽 근처에 띄운다 → 화면 표시 = 실제 마을 HP 피해와 1:1.
 */
function InvasionLayer({
  monsters,
  hits,
}: {
  monsters: readonly MonsterId[];
  hits: SiegeFloatingHit[];
}) {
  const COUNT = 4;
  // 마운트 시 각 몬스터의 종류·속도·시작 지연을 랜덤 고정 (양수 지연 → 한꺼번에 안 나오고 시차 등장)
  const lineup = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        key: i,
        monsterId: monsters[i % monsters.length],
        dur: 9 + Math.random() * 4, // 9~13s — 천천히
        delay: i * 2.4, // 시차 등장
      })),
    [monsters],
  );

  return (
    <div className="invasion-layer">
      {lineup.map((a) => (
        <Attacker key={a.key} monsterId={a.monsterId} dur={a.dur} delay={a.delay} />
      ))}
      {hits.map((h) => {
        // 실제 피해 1건 = 숫자 1개. 마을 벽 둘레의 (시드 기반) 한 지점에서 솟구침
        const seed = (h.id * 2654435761) >>> 0;
        const ang = ((seed % 360) * Math.PI) / 180;
        const r = 13 + (seed % 7);
        return (
          <span
            key={h.id}
            className="hit-dmg"
            style={{ left: `${50 + Math.cos(ang) * r}%`, top: `${50 + Math.sin(ang) * r}%` }}
          >
            -{h.amount}
          </span>
        );
      })}
    </div>
  );
}

function DetailContent({
  sel,
  game,
  stage,
  tier,
  stats,
  wall,
  wallCost,
  reinforce,
  build,
  repair,
  enterDungeon,
}: {
  sel: Selection;
  game: ReturnType<typeof useGame.getState>['game'];
  stage: ReturnType<typeof currentStage>;
  tier: ReturnType<typeof currentTier>;
  stats: ReturnType<typeof computeVillageStats>;
  wall: { hp: number; defense: number };
  wallCost: ReturnType<typeof wallReinforceCost>;
  reinforce: () => void;
  build: (cellIndex: number, buildingId: BuildingId) => void;
  repair: (cellIndex: number) => void;
  enterDungeon: (id: DungeonId) => void;
}) {
  const v = game.village;

  if (sel.kind === 'wave') {
    const est = estimateInvasion(stats, tier.monsters);
    const safe = Number.isFinite(est.net) && est.net <= 0;
    const holdWaves =
      safe || !Number.isFinite(est.net) ? Infinity : est.net > 0 ? Math.floor((stats.maxHp - 1) / est.net) : Infinity;
    return (
      <>
        <h3>🌊 웨이브 침공 — {tier.name}</h3>
        <p className="dim">
          주기마다 약 2분간 몬스터가 몰려옵니다. 마을이 자동으로 한 마리씩 처치하며, 처치 사이에 받는
          피해로 HP가 실시간으로 깎입니다. HP가 바닥나면 구조물이 무너지고 농성에 들어갑니다. (오프라인 보상 50%)
        </p>
        <div className="chips">
          {tier.monsters.map((id, i) => (
            <span key={i} className="chip"><GameIcon id={id} emoji={getMonster(id).icon} /> {getMonster(id).name}</span>
          ))}
          <span className="chip big">보상 ×{tier.rewardMultiplier}</span>
        </div>
        <div className="chips">
          <span className="chip">침공당 ~{Number.isFinite(est.kills) ? est.kills : 0}처치</span>
          <span className="chip">예상 피해 {Number.isFinite(est.damage) ? est.damage : '∞'}</span>
          <span className="chip">회복 +{est.regen}</span>
          <span className={`chip ${safe ? 'big' : 'bad'}`}>
            {safe
              ? '✅ 안전 (회복 ≥ 피해)'
              : !Number.isFinite(est.net)
                ? '⛔ 처치 불가 — 즉시 함락'
                : `⚠️ 약 ${holdWaves}회 버팀`}
          </span>
        </div>
      </>
    );
  }

  if (sel.kind === 'wall') {
    return (
      <>
        <h3>🧱 외곽 성벽 — Lv {v.wallLevel}/{MAX_WALL_LEVEL}</h3>
        <p className="dim">
          마을 전체를 두르는 방벽입니다. 강화할수록 마을 최대 HP·방어가 오릅니다. 웨이브 패배 시 가장 먼저
          일부가 무너집니다.
        </p>
        <div className="chips">
          <span className="chip">최대 HP +{wall.hp}</span>
          <span className="chip">방어 +{wall.defense}</span>
        </div>
        {wallCost ? (
          <>
            <div className="chips">강화 비용 (Lv {v.wallLevel + 1}): {costChips(wallCost.gold, wallCost.items)}</div>
            <button className="m-btn" onClick={reinforce}>🧱 성벽 강화</button>
          </>
        ) : (
          <div className="chips"><span className="chip">최대 레벨 도달</span></div>
        )}
      </>
    );
  }

  if (sel.kind === 'cell') {
    const slot = v.buildings[sel.index];
    // 빈 터 → 건설
    if (!slot) {
      return (
        <>
          <h3>➕ 빈 터 — 건설</h3>
          <p className="dim">1칸에 건물 1개. 같은 건물을 여러 채 지으면 효과가 누적됩니다. (성벽은 마을 외곽에서 따로 강화)</p>
          <div className="build-options">
            {buildableBuildings().map((b) => (
              <div key={b.id} className="build-card">
                <div className="bt"><GameIcon id={b.id} emoji={b.icon} /> {b.name}</div>
                <div className="chips">
                  {b.attack ? <span className="chip">공격 +{b.attack}</span> : null}
                  {b.hp ? <span className="chip">HP +{b.hp}</span> : null}
                  {b.defense ? <span className="chip">방어 +{b.defense}</span> : null}
                </div>
                <div className="chips">{costChips(b.buildGold ?? 0, b.buildItems ?? [])}</div>
                <button className="m-btn" onClick={() => build(sel.index, b.id)}>건설</button>
              </div>
            ))}
          </div>
        </>
      );
    }
    const def = getBuilding(slot.id);
    // 파손 → 수리
    if (slot.damaged) {
      const cost = repairCost(slot.id);
      return (
        <>
          <h3>🏚️ <GameIcon id={slot.id} emoji={def.icon} /> {def.name} — ⚠️ 파손됨</h3>
          <p className="dim">
            웨이브 패배로 파손되어 효과가 정지되었습니다. 외곽 성벽이 모두 무너진 뒤에는 안쪽 건물이
            파손됩니다(본부 제외).
          </p>
          <div className="chips">
            <span className="chip bad">
              효과 정지: {def.attack ? `공격 +${def.attack} ` : ''}{def.hp ? `HP +${def.hp} ` : ''}{def.defense ? `방어 +${def.defense}` : ''}
            </span>
          </div>
          <div className="chips">수리 비용: {costChips(cost.gold, cost.items)}</div>
          <button className="m-btn" onClick={() => repair(sel.index)}>🔧 수리하기</button>
        </>
      );
    }
    // 본부 → 마을 합산 스탯
    if (def.fixed) {
      return (
        <>
          <h3><GameIcon id={slot.id} emoji={def.icon} /> {def.name} — 마을 스탯</h3>
          <p className="dim">{def.description}</p>
          <table className="stat-table">
            <tbody>
              <tr><td>외곽 성벽 <span className="dim">(Lv {v.wallLevel})</span></td><td>HP +{wall.hp}</td><td>—</td><td>방어 +{wall.defense}</td></tr>
              <tr className="sum"><td>마을 합계</td><td>HP {stats.maxHp}</td><td>공격 {stats.attackPower}</td><td>방어 {stats.defense}</td></tr>
            </tbody>
          </table>
        </>
      );
    }
    // 일반 건물
    return (
      <>
        <h3><GameIcon id={slot.id} emoji={def.icon} /> {def.name}</h3>
        <div className="chips">
          {def.attack ? <span className="chip">공격 +{def.attack}</span> : null}
          {def.hp ? <span className="chip">HP +{def.hp}</span> : null}
          {def.defense ? <span className="chip">방어 +{def.defense}</span> : null}
        </div>
        <p className="dim">{def.description}</p>
      </>
    );
  }

  if (sel.kind === 'dungeon') {
    const dungeon = allDungeons().find((d) => d.id === sel.id)!;
    const clears = game.dungeonClears[dungeon.id] ?? 0;
    const first = clears === 0;
    const rewards = first ? dungeon.firstRewards : dungeon.repeatRewards;
    return (
      <>
        <h3><GameIcon id={dungeon.id} emoji={dungeon.icon} /> {dungeon.name} <span className="dim">(권장 공격 Lv {dungeon.level})</span></h3>
        <p className="dim">
          언제든 도전 가능 (쿨다운 없음). {first ? '최초 클리어는 큰 보상 + 다음 웨이브 티어 해금' : `반복 보상 (이미 ${clears}회 클리어)`}.
        </p>
        <div className="chips">
          {dungeon.monsters.map((id, i) => {
            const m = getMonster(id);
            const boss = i === dungeon.monsters.length - 1;
            return <span key={i} className="chip"><GameIcon id={id} emoji={m.icon} /> {m.name}{boss ? ' (보스)' : ''}</span>;
          })}
        </div>
        <div className="chips">
          {first ? '최초 보상: ' : '반복 보상: '}
          {rewards.map((r) => (
            <span key={r.itemId} className="chip big">
              <GameIcon id={r.itemId} emoji={getItem(r.itemId).icon} /> {getItem(r.itemId).name} ×{r.qty}
              {r.chance < 1 ? ` (${Math.round(r.chance * 100)}%)` : ''}
            </span>
          ))}
        </div>
        <button className="m-btn" onClick={() => enterDungeon(dungeon.id)}>⚔️ 입장</button>
      </>
    );
  }

  // 기본
  return (
    <>
      <h3>🗺️ {stage.name}</h3>
      <p className="dim">
        평화로운 잔디밭에서 시작하는 첫 마을입니다. 성벽·마을 칸·던전·웨이브 배너를 클릭하면 여기에 상세
        정보와 행동이 나타납니다. 마을을 지키며 던전을 클리어해 더 높은 웨이브 티어를 해금하세요.
      </p>
    </>
  );
}
