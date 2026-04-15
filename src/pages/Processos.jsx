import { useEffect, useState } from 'react';
import { listProcessos } from '../lib/db.js';
import { Empty, Badge, fmtD } from '../components/ui.jsx';

export default function Processos() {
  const [procs, setProcs] = useState([]);
  useEffect(() => { listProcessos().then(setProcs); }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="topbar-brand-tag">CORPORATE P&A</div>
        <h1 className="serif" style={{ fontSize: 30, marginTop: 4 }}>Processos</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Histórico de deliberações geradas.</p>
      </div>

      {procs.length === 0 ? <Empty title="Sem processos. Crie a primeira deliberação no Dashboard." /> : (
        <table className="table">
          <thead><tr><th>Sociedade</th><th>Título</th><th>Profissional</th><th>Data</th><th>Estado</th></tr></thead>
          <tbody>
            {procs.map(p => (
              <tr key={p.id}>
                <td><strong>{p.sociedades?.firma}</strong><div style={{ fontSize: 11, color: '#6B7280' }}>NIPC {p.sociedades?.nipc}</div></td>
                <td>{p.titulo}<div style={{ fontSize: 11, color: '#6B7280' }}>{(p.tipos_deliberacao || []).join(', ')}</div></td>
                <td>{p.profissional_nome || '—'}</td>
                <td>{fmtD(p.data_processo)}</td>
                <td><Badge variant={p.estado === 'concluido' ? 'success' : p.estado === 'rascunho' ? 'neutral' : 'warn'}>{p.estado}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
