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

function Shell() {
  const { session, loading } = useAuth();
  const [view, setView] = useState('dashboard');
  const [socIdToOpen, setSocIdToOpen] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>A carregar...</div>;
  if (!session) return <Login />;

  const goto = (v, opts) => {
    if (v === 'wizard') { setShowWizard(true); return; }
    setShowWizard(false);
    setView(v);
    if (opts?.socId) { setSocIdToOpen(opts.socId); setView('sociedades'); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={showWizard ? '' : view} setActive={(v) => { setShowWizard(false); setView(v); setSocIdToOpen(null); }} />
      <main className="main-content" style={{ flex: 1, maxHeight: '100vh', overflow: 'auto' }}>
        <div className="page-content">
          {showWizard ? <Wizard onCancel={() => setShowWizard(false)} onDone={() => { setShowWizard(false); setView('processos'); }} /> :
           view === 'dashboard' ? <Dashboard onNew={() => setShowWizard(true)} onGoSociedade={(id) => goto('sociedades', { socId: id })} /> :
           view === 'sociedades' ? <Sociedades socIdToOpen={socIdToOpen} /> :
           view === 'processos' ? <Processos /> :
           view === 'documentos' ? <DocumentosAvulsos /> :
           view === 'configuracoes' ? <Configuracoes /> :
           <Dashboard onNew={() => setShowWizard(true)} />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>;
}
