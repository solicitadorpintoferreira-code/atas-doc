import { useEffect, useState } from 'react';
import { listProfissionais, updateProfissional, listObrigacoes } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Input, Alert, Badge, Empty } from '../components/ui.jsx';
import { supabase } from '../lib/supabase.js';

export default function Configuracoes() {
  const [tab, setTab] = useState('profissionais');
  const [profs, setProfs] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaPass, setNovaPass] = useState('');
  const [msg, setMsg] = useState('');
  const { profissional } = useAuth();

  const reload = async () => { setProfs(await listProfissionais()); setObrigacoes(await listObrigacoes()); };
  useEffect(() => { reload(); }, []);

  const criarProfissional = async () => {
    setMsg('');
    if (!novoEmail || !novaPass || novaPass.length < 6) { setMsg('Email e password (mín. 6 caracteres) obrigatórios.'); return; }
    const { data, error } = await supabase.auth.signUp({ email: novoEmail, password: novaPass, options: { data: { nome: novoNome || novoEmail.split('@')[0] } } });
    if (error) { setMsg('Erro: ' + error.message); return; }
    setMsg(`Profissional criado. Pode aceder com ${novoEmail}.`);
    setNovoEmail(''); setNovoNome(''); setNovaPass('');
    setTimeout(reload, 1500);
  };

  const toggle = async (p, k) => { await updateProfissional(p.id, { [k]: !p[k] }); reload(); };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="topbar-brand-tag">CORPORATE P&A</div>
        <h1 className="serif" style={{ fontSize: 30, marginTop: 4 }}>Configurações</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
        {[{ id: 'profissionais', l: 'Profissionais' }, { id: 'obrigacoes', l: 'Obrigações standard' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #8B7355' : '2px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#1F2937' : '#6B7280' }}>{t.l}</button>
        ))}
      </div>

      {tab === 'profissionais' && (
        <div>
          {profissional?.is_admin ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Adicionar profissional</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                <Input label="Nome" value={novoNome} onChange={setNovoNome} placeholder="Ex: João Silva" />
                <Input label="Email" type="email" value={novoEmail} onChange={setNovoEmail} placeholder="nome@pa-legal.pt" />
                <Input label="Password (mín. 6)" type="text" value={novaPass} onChange={setNovaPass} placeholder="••••••" />
                <Btn onClick={criarProfissional}>Criar</Btn>
              </div>
              {msg && <div style={{ marginTop: 10, padding: 10, fontSize: 12, background: msg.startsWith('Erro') ? '#FEE2E2' : '#D1FAE5', color: msg.startsWith('Erro') ? '#991B1B' : '#065F46', borderRadius: 6 }}>{msg}</div>}
            </div>
          ) : <Alert variant="info">Apenas administradores podem adicionar profissionais.</Alert>}

          <table className="table">
            <thead><tr><th>Nome</th><th>Email</th><th>Cargo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {profs.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nome}</strong>{p.is_admin && <Badge variant="info" >ADMIN</Badge>}</td>
                  <td>{p.email}</td>
                  <td>{p.cargo}</td>
                  <td><Badge variant={p.ativo ? 'success' : 'neutral'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td>{profissional?.is_admin && p.id !== profissional.id && <Btn variant="ghost" size="sm" onClick={() => toggle(p, 'ativo')}>{p.ativo ? 'Desativar' : 'Ativar'}</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'obrigacoes' && (
        <table className="table">
          <thead><tr><th>Obrigação</th><th>Descrição</th><th>Quando</th><th>Periodicidade</th></tr></thead>
          <tbody>
            {obrigacoes.map(o => (
              <tr key={o.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: o.cor }}/><strong>{o.nome}</strong></div></td>
                <td>{o.descricao}</td>
                <td>{String(o.dia).padStart(2, '0')}/{String(o.mes).padStart(2, '0')}</td>
                <td><Badge variant="neutral">{o.periodicidade}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
