import { currentStage, getAction } from '@idle-rpg/core';
import { useEffect } from 'react';
import { CollectionPanel } from './components/CollectionPanel';
import { DungeonResultModal } from './components/DungeonResultModal';
import { InventoryPanel } from './components/InventoryPanel';
import { MapPanel } from './components/MapPanel';
import { OfflineModal } from './components/OfflineModal';
import { SettingsPanel } from './components/SettingsPanel';
import { ShopPanel } from './components/ShopPanel';
import { Sidebar } from './components/Sidebar';
import { SkillPanel } from './components/SkillPanel';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { useGame, type Panel } from './store';

const TICK_MS = 200;
const AUTOSAVE_MS = 5000;

function MainPanel({ panel }: { panel: Panel }) {
  switch (panel) {
    case 'map':
      return <MapPanel />;
    case 'inventory':
      return <InventoryPanel />;
    case 'shop':
      return <ShopPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'collection':
      return <CollectionPanel />;
    case 'attack':
    case 'hitpoints':
      return <MapPanel />;
    default:
      return <SkillPanel skillId={panel} />;
  }
}

export default function App() {
  const panel = useGame((s) => s.panel);
  const offline = useGame((s) => s.offline);
  const dungeonResult = useGame((s) => s.dungeonResult);
  const activeKey = useGame((s) => s.game.activeActions.map((a) => a.actionId).join(','));
  const themeClass = useGame((s) => currentStage(s.game).themeClass);

  // 현재 맵 단계의 테마를 <body>에 적용 → 상단바·사이드바·모든 화면이 함께 리테마
  useEffect(() => {
    document.body.classList.remove('s1', 's2', 's3', 's4', 's5');
    document.body.classList.add(themeClass);
  }, [themeClass]);

  useEffect(() => {
    const ids = activeKey === '' ? [] : activeKey.split(',');
    document.title =
      ids.length === 0
        ? 'Bulwark — 불워크'
        : ids.length === 1
          ? `[${getAction(ids[0]).name}] Bulwark`
          : `[작업 ${ids.length}개] Bulwark`;
  }, [activeKey]);

  useEffect(() => {
    const tickId = setInterval(() => useGame.getState().tick(), TICK_MS);
    const saveId = setInterval(() => useGame.getState().save(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') useGame.getState().save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      clearInterval(tickId);
      clearInterval(saveId);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          <MainPanel panel={panel} />
        </main>
      </div>
      <Toasts />
      {dungeonResult && <DungeonResultModal result={dungeonResult} />}
      {offline && <OfflineModal gains={offline} />}
    </div>
  );
}
