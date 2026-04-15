import { useAuth } from '../lib/auth.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'sociedades', label: 'Sociedades', icon: '◈' },
  { id: 'processos', label: 'Processos', icon: '☰' },
  { id: 'documentos', label: 'Documentos avulsos', icon: '✎' },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙' },
];

export default function Sidebar({ active, setActive }) {
  const { profissional, signOut } = useAuth();
  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="sidebar-brand">
        <div className="sidebar-tag">CORPORATE P&A</div>
        <div className="sidebar-title">ATAS PRO</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(n => (
          <div key={n.id} onClick={() => setActive(n.id)} className={`sidebar-link ${active === n.id ? 'active' : ''}`}>
            <span className="sidebar-link-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}
      </nav>
      <div style={{ padding: '16px 24px', borderTop: '1px solid #2F2A22' }}>
        <div style={{ fontSize: 12, color: '#F1F0EC', fontWeight: 500 }}>{profissional?.nome || '—'}</div>
        <div style={{ fontSize: 10, color: '#9C9482', marginTop: 2 }}>{profissional?.cargo}</div>
        <button onClick={signOut} style={{ marginTop: 12, fontSize: 11, color: '#9C9482', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Terminar sessão →</button>
      </div>
    </aside>
  );
}
