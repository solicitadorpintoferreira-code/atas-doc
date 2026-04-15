import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sociedades from './pages/Sociedades.jsx';
import Processos from './pages/Processos.jsx';
import DocumentosAvulsos from './pages/DocumentosAvulsos.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import Wizard from './pages/Wizard.jsx';
import Atlas from './pages/Atlas.jsx';
import Wikipedia from './pages/Wikipedia.jsx';

// Atlas e Wikipedia têm layout próprio que usa toda a altura — sem padding extra
const FULL_HEIGHT_VIEWS = ['atlas', 'wikipedia'];

function Shell() {
  const { session, loading } = useAuth();
  const [view, setView] = useState('dashboard');
  const [socIdToOpen, setSocIdToOpen] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
      A carregar...
    </div>
  );
  if (!session) return <Login />;

  const goto = (v, opts) => {
    if (v === 'wizard') { setShowWizard(true); return; }
    setShowWizard(false);
    setView(v);
    if (opts?.socId) { setSocIdToOpen(opts.socId); setView('sociedades'); }
  };

  const isFullHeight = !showWizard && FULL_HEIGHT_VIEWS.includes(view);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        active={showWizard ? '' : view}
        setActive={(v) => { setShowWizard(false); setView(v); setSocIdToOpen(null); }}
      />
      <main className="main-content" style={{ flex: 1, maxHeight: '100vh', overflow: isFullHeight ? 'hidden' : 'auto' }}>
        <div className={isFullHeight ? '' : 'page-content'} style={isFullHeight ? { padding: 0 } : {}}>
          {showWizard
            ? <div className="page-content"><Wizard onCancel={() => setShowWizard(false)} onDone={() => { setShowWizard(false); setView('processos'); }} /></div>
            : view === 'dashboard'    ? <div className="page-content"><Dashboard onNew={() => setShowWizard(true)} onGoSociedade={(id) => goto('sociedades', { socId: id })} /></div>
            : view === 'sociedades'   ? <div className="page-content"><Sociedades socIdToOpen={socIdToOpen} /></div>
            : view === 'processos'    ? <div className="page-content"><Processos /></div>
            : view === 'documentos'   ? <div className="page-content"><DocumentosAvulsos /></div>
            : view === 'atlas'        ? <Atlas />
            : view === 'wikipedia'    ? <Wikipedia />
            : view === 'configuracoes'? <div className="page-content"><Configuracoes /></div>
            : <div className="page-content"><Dashboard onNew={() => setShowWizard(true)} /></div>
          }
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>;
}
