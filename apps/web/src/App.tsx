import { useEffect } from 'react';
import { InventoryPanel } from './components/InventoryPanel';
import { OfflineModal } from './components/OfflineModal';
import { Sidebar } from './components/Sidebar';
import { SkillPanel } from './components/SkillPanel';
import { TopBar } from './components/TopBar';
import { useGame } from './store';

const TICK_MS = 200;
const AUTOSAVE_MS = 5000;

export default function App() {
  const panel = useGame((s) => s.panel);
  const offline = useGame((s) => s.offline);

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
          {panel === 'inventory' ? <InventoryPanel /> : <SkillPanel skillId={panel} />}
        </main>
      </div>
      {offline && <OfflineModal gains={offline} />}
    </div>
  );
}
