import { useEffect, useState } from 'react';
import { listProcessos, listObrigacoes, calcularProximasObrigacoesPortugal } from '../lib/db.js';
import { Btn, Badge, fmtD } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Dashboard({ onNew }) {
  const [procs, setProcs] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const { profissional } = useAuth();

  useEffect(() => {
    (async () => {
      setProcs((await listProcessos()).slice(0, 8));
      setObrigacoes(await listObrigacoes());
    })();
  }, []);

  const eventos = calcularProximasObrigacoesPortugal(obrigacoes, 90);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div className="topbar-brand-tag">CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 30, marginTop: 4 }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Bem-vindo, {profissional?.nome?.split(' ')[0] || ''}</p>
        </div>
        <Btn onClick={onNew}>+ Nova deliberação</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { l: 'Obrigações nos próximos 90 dias', v: eventos.length },
          { l: 'Processos recentes', v: procs.length },
          { l: 'Profissional', v: profissional?.nome?.split(' ')[0] || '—', small: true },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className="field-label">{s.l}</div>
            <div className="serif" style={{ fontSize: s.small ? 18 : 32, fontWeight: 600, marginTop: 8, color: '#1F2937' }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card">
          <h2 className="serif" style={{ fontSize: 18, marginBottom: 6, fontWeight: 600 }}>Calendário de obrigações</h2>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
            Próximos 90 dias · Aplica-se a todas as empresas portuguesas
          </p>
          {eventos.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Sem obrigações nos próximos 90 dias.</p>
          ) : eventos.map((e, i) => (
            <div key={i} className="cal-event" style={{ borderLeftColor: e.cor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="cal-event-date">{fmtD(e.data)}</div>
                <Badge variant="neutral">{e.periodicidade}</Badge>
              </div>
              <div className="cal-event-title">{e.obrigacao}</div>
              {e.descricao && <div className="cal-event-soc">{e.descricao}</div>}
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="serif" style={{ fontSize: 18, marginBottom: 14, fontWeight: 600 }}>Processos recentes</h2>
          {procs.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Sem processos ainda.</p>
          ) : procs.map(p => (
            <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.titulo}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.sociedades?.firma}</span>
                <span>{fmtD(p.data_processo)} · {p.profissional_nome}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
