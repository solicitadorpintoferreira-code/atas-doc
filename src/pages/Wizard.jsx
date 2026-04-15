import { useEffect, useState, useMemo } from 'react';
import { listSociedades, createSociedade, getSociedadeByNipc, listDocsExigidos, createProcesso } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Input, Select, Textarea, Alert, Badge, fmt } from '../components/ui.jsx';
import { generateAtaSimples, generateContratoCessao, generateAcordoParassocial, generateListaSocios, generateDeclaracaoBemProprio } from '../lib/docs.js';

const TIPOS_DELIB = [
  { id: 'aumento_capital', label: 'Aumento de Capital', cat: 'capital' },
  { id: 'cessao_quotas', label: 'Cessão de Quotas', cat: 'quotas' },
  { id: 'alteracao_firma', label: 'Alteração de Firma', cat: 'pacto', certAdm: true },
  { id: 'alteracao_sede', label: 'Alteração de Sede', cat: 'pacto', certAdm: true },
  { id: 'alteracao_objeto', label: 'Alteração de Objeto', cat: 'pacto', certAdm: true },
  { id: 'aprovacao_contas', label: 'Aprovação de Contas', cat: 'contas' },
  { id: 'distribuicao_lucros', label: 'Distribuição de Lucros', cat: 'contas' },
  { id: 'nomeacao_gerente', label: 'Nomeação de Gerente', cat: 'gerencia' },
  { id: 'destituicao_gerente', label: 'Destituição de Gerente', cat: 'gerencia' },
  { id: 'dissolucao', label: 'Dissolução', cat: 'vida' },
];
const CATS = { capital: 'Capital', quotas: 'Quotas', pacto: 'Pacto Social', contas: 'Contas', gerencia: 'Gerência', vida: 'Vida da Sociedade' };

export default function Wizard({ onCancel, onDone }) {
  const { profissional } = useAuth();
  const [step, setStep] = useState(0);
  const [socs, setSocs] = useState([]);
  const [soc, setSoc] = useState(null);
  const [nipcInput, setNipcInput] = useState('');
  const [novoSoc, setNovoSoc] = useState(null);
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [docsExigidos, setDocsExigidos] = useState([]);
  const [docsCheck, setDocsCheck] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { listSociedades().then(setSocs); }, []);
  useEffect(() => { if (soc?.id) listDocsExigidos(soc.id).then(setDocsExigidos); }, [soc]);

  const procurar = async () => {
    const clean = nipcInput.replace(/[\s.]/g, '');
    if (clean.length < 9) return;
    const found = await getSociedadeByNipc(clean);
    if (found) setSoc(found);
    else setNovoSoc({ nipc: clean, firma: '', tipo: 'Sociedade por Quotas', sede: '', capital: 0, socios: [{ letra: 'A', quota: 0, pct: 100 }], _new: true });
  };

  const criarESelecionar = async () => {
    const created = await createSociedade(novoSoc, profissional?.id);
    setSoc(created);
    setNovoSoc(null);
  };

  const togDel = id => setSelDel(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);
  const upd = (did, k, v) => setFdMap(p => ({ ...p, [did]: { ...(p[did] || {}), [k]: v } }));
  const getFd = did => fdMap[did] || {};

  const docsAGerar = useMemo(() => {
    const out = ['Ata'];
    selDel.forEach(did => {
      if (did === 'cessao_quotas') {
        const fd = getFd(did);
        out.push('Lista de Sócios');
        out.push('Contrato de Cessão');
        if (fd.gerar_parassocial === 'sim') out.push('Acordo Parassocial');
        if (fd.gerar_bem_proprio === 'sim') out.push('Declaração de Bem Próprio');
      }
      if (did === 'aumento_capital') out.push('Lista de Sócios');
    });
    return [...new Set(out)];
  }, [selDel, fdMap]);

  const finalizar = async () => {
    setBusy(true);
    try {
      await createProcesso({
        sociedade_id: soc.id,
        titulo: `Deliberação ${new Date().toLocaleDateString('pt-PT')}`,
        descricao: selDel.map(d => TIPOS_DELIB.find(t => t.id === d)?.label).join(', '),
        tipos_deliberacao: selDel,
        estado: 'concluido',
        data_processo: new Date().toISOString().split('T')[0],
        dados_form: fdMap,
        documentos_gerados: docsAGerar,
        profissional_id: profissional?.id,
        profissional_nome: profissional?.nome,
      });
    } catch (e) { console.error(e); }
    setBusy(false);
    onDone();
  };

  const baixarDoc = async (nome) => {
    setBusy(true);
    try {
      const cesFd = fdMap.cessao_quotas || {};
      if (nome === 'Ata') await generateAtaSimples(soc, { numero: '__', data: new Date().toLocaleDateString('pt-PT') });
      else if (nome === 'Lista de Sócios') await generateListaSocios(soc);
      else if (nome === 'Contrato de Cessão') await generateContratoCessao(soc, { cedenteId: cesFd.cedenteId, cessionarioId: cesFd.cessionarioId, valor: cesFd.valor, local: 'Lisboa' });
      else if (nome === 'Acordo Parassocial') await generateAcordoParassocial(soc, { limite_inv: cesFd.limite_inv, limite_cont: cesFd.limite_cont });
      else if (nome === 'Declaração de Bem Próprio') await generateDeclaracaoBemProprio(soc, { socioId: cesFd.bem_proprio_socio });
    } catch (e) { alert('Erro: ' + e.message); }
    setBusy(false);
  };

  const stepNames = ['Sociedade', 'Documentos do cliente', 'Deliberações', 'Detalhes', 'Gerar'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="topbar-brand-tag">CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 28, marginTop: 4 }}>Nova deliberação</h1>
        </div>
        <Btn variant="ghost" onClick={onCancel}>✕ Cancelar</Btn>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {stepNames.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < stepNames.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i <= step ? '#8B7355' : '#E5E7EB', color: i <= step ? '#fff' : '#9CA3AF' }}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i <= step ? '#1F2937' : '#9CA3AF' }}>{s}</span>
            </div>
            {i < stepNames.length - 1 && <div style={{ flex: 1, height: 1, margin: '0 12px', background: i < step ? '#8B7355' : '#E5E7EB' }}/>}
          </div>
        ))}
      </div>

      {/* STEP 0 */}
      {step === 0 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Sociedade</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
            <Input label="NIPC" value={nipcInput} onChange={setNipcInput} placeholder="Ex: 516234567" style={{ flex: 1 }} />
            <Btn onClick={procurar}>Procurar</Btn>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Ou selecionar das existentes:</div>
          <Select value={soc?.id} onChange={id => setSoc(socs.find(s => s.id === id))} options={socs.map(s => ({ v: s.id, l: `${s.firma} (${s.nipc})` }))} placeholder="Escolher sociedade existente..." />

          {soc && (
            <div style={{ marginTop: 16, padding: 16, background: '#FAFAF8', borderRadius: 8 }}>
              <div className="card-title">{soc.firma}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>NIPC {soc.nipc} · {soc.tipo} · Capital {fmt(soc.capital)}</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>{soc.socios?.length || 0} sócios</div>
            </div>
          )}

          {novoSoc && (
            <div style={{ marginTop: 16, padding: 16, background: '#FEF8E7', borderRadius: 8, border: '1px solid #FCD34D' }}>
              <Alert variant="warn">Sociedade não encontrada. Criar nova com este NIPC:</Alert>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <Input label="Firma" value={novoSoc.firma} onChange={v => setNovoSoc({ ...novoSoc, firma: v })} required />
                <Input label="Capital (€)" type="number" value={novoSoc.capital} onChange={v => setNovoSoc({ ...novoSoc, capital: v })} />
                <div style={{ gridColumn: '1/-1' }}><Input label="Sede" value={novoSoc.sede} onChange={v => setNovoSoc({ ...novoSoc, sede: v })} required /></div>
              </div>
              <Btn onClick={criarESelecionar} style={{ marginTop: 12 }}>Criar e continuar</Btn>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn disabled={!soc} onClick={() => setStep(1)}>Continuar →</Btn>
          </div>
        </div>
      )}

      {/* STEP 1 - Documentos do cliente */}
      {step === 1 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Documentos do cliente</h3>
          {docsExigidos.length === 0 ? (
            <Alert variant="info">Esta sociedade não tem documentos exigidos configurados. Pode definir uma checklist personalizada em Sociedades → Editar → Documentos exigidos.</Alert>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Confirmar receção dos documentos exigidos antes de avançar:</p>
              {docsExigidos.map((d, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, background: '#FAFAF8', borderRadius: 6, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!docsCheck[d.id]} onChange={e => setDocsCheck(p => ({ ...p, [d.id]: e.target.checked }))} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{d.nome} {d.obrigatorio && <Badge variant="warn">Obrigatório</Badge>}</div>
                    {d.descricao && <div style={{ fontSize: 11, color: '#6B7280' }}>{d.descricao}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setStep(0)}>← Voltar</Btn>
            <Btn onClick={() => setStep(2)}>Continuar →</Btn>
          </div>
        </div>
      )}

      {/* STEP 2 - Deliberações */}
      {step === 2 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Deliberações</h3>
          {Object.entries(CATS).map(([cid, cl]) => {
            const items = TIPOS_DELIB.filter(t => t.cat === cid);
            return (
              <div key={cid} style={{ marginBottom: 16 }}>
                <div className="field-label" style={{ marginBottom: 6 }}>{cl}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {items.map(t => {
                    const sel = selDel.includes(t.id);
                    return (
                      <div key={t.id} onClick={() => togDel(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 6, cursor: 'pointer', border: sel ? '2px solid #8B7355' : '1px solid #E5E7EB', background: sel ? '#FAF6EE' : '#fff' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 3, border: sel ? 'none' : '2px solid #D1D5DB', background: sel ? '#8B7355' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{sel && '✓'}</div>
                        <div style={{ fontSize: 13, fontWeight: sel ? 600 : 400 }}>{t.label}</div>
                        {t.certAdm && <Badge variant="warn">Cert. Adm.</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setStep(1)}>← Voltar</Btn>
            <Btn disabled={selDel.length === 0} onClick={() => setStep(3)}>Continuar →</Btn>
          </div>
        </div>
      )}

      {/* STEP 3 - Detalhes */}
      {step === 3 && (
        <div>
          {selDel.map(did => {
            const t = TIPOS_DELIB.find(x => x.id === did);
            const fd = getFd(did);
            return (
              <div key={did} className="card" style={{ marginBottom: 12 }}>
                <h3 className="serif" style={{ fontSize: 16, marginBottom: 14 }}>{t.label}</h3>

                {did === 'aumento_capital' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <Input label="Capital atual" value={fmt(soc.capital)} disabled />
                    <Input label="Montante (€)" type="number" value={fd.aum_montante} onChange={v => upd(did, 'aum_montante', v)} required />
                    <Input label="Novo capital" value={fd.aum_montante ? fmt((soc.capital || 0) + Number(fd.aum_montante)) : ''} disabled />
                  </div>
                )}

                {did === 'cessao_quotas' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Select label="Cedente" value={fd.cedenteId} onChange={v => upd(did, 'cedenteId', v)} options={(soc.socios || []).map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || '(sem nome)'}` }))} required />
                    <Select label="Cessionário" value={fd.cessionarioId} onChange={v => upd(did, 'cessionarioId', v)} options={(soc.socios || []).map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || '(sem nome)'}` }))} />
                    <Input label="Valor (€)" type="number" value={fd.valor} onChange={v => upd(did, 'valor', v)} />
                    <Input label="Data cessão" value={fd.data_cessao} onChange={v => upd(did, 'data_cessao', v)} placeholder="Ex: 15 de abril de 2026" />

                    <div style={{ gridColumn: '1/-1', marginTop: 12, padding: 14, background: '#FDF8F0', borderRadius: 8, border: '1px solid #E9D8AB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <strong style={{ fontSize: 13, color: '#78582A' }}>Documentos complementares</strong>
                        <button onClick={() => { upd(did, 'gerar_parassocial', 'sim'); upd(did, 'gerar_bem_proprio', 'sim'); }} style={{ fontSize: 11, padding: '4px 10px', background: '#78582A', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Selecionar todos</button>
                      </div>
                      <label style={{ display: 'flex', gap: 8, padding: 6, fontSize: 13 }}><input type="checkbox" checked={fd.gerar_parassocial === 'sim'} onChange={e => upd(did, 'gerar_parassocial', e.target.checked ? 'sim' : 'nao')} /> Acordo Parassocial</label>
                      <label style={{ display: 'flex', gap: 8, padding: 6, fontSize: 13 }}><input type="checkbox" checked={fd.gerar_bem_proprio === 'sim'} onChange={e => upd(did, 'gerar_bem_proprio', e.target.checked ? 'sim' : 'nao')} /> Declaração de Bem Próprio</label>
                      {fd.gerar_bem_proprio === 'sim' && <Select label="Sócio (casado em comunhão)" value={fd.bem_proprio_socio} onChange={v => upd(did, 'bem_proprio_socio', v)} options={(soc.socios || []).filter(s => s.estado_civil === 'casado').map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome}` }))} />}
                    </div>
                  </div>
                )}

                {(did === 'alteracao_firma' || did === 'alteracao_sede' || did === 'alteracao_objeto') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <Input label="Texto atual" value={did === 'alteracao_firma' ? soc.firma : did === 'alteracao_sede' ? soc.sede : soc.objeto} disabled />
                    <Input label="Novo texto" value={fd.novo_texto} onChange={v => upd(did, 'novo_texto', v)} required />
                    <div style={{ padding: 12, background: '#FEF8E7', borderRadius: 6, border: '1px solid #FCD34D' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F', marginBottom: 8 }}>Certificado de Admissibilidade</div>
                      <Input label="Código de acesso" value={fd.cert_codigo} onChange={v => upd(did, 'cert_codigo', v)} placeholder="Ex: 1475-1647-4386" />
                    </div>
                  </div>
                )}

                {did === 'aprovacao_contas' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Input label="Exercício" value={fd.exercicio} onChange={v => upd(did, 'exercicio', v)} placeholder="2025" />
                    <Input label="Resultado líquido (€)" type="number" value={fd.resultado} onChange={v => upd(did, 'resultado', v)} />
                  </div>
                )}

                {(did === 'distribuicao_lucros' || did === 'nomeacao_gerente' || did === 'destituicao_gerente' || did === 'dissolucao') && (
                  <Textarea label="Detalhes" value={fd.detalhes} onChange={v => upd(did, 'detalhes', v)} placeholder="Descrever os termos da deliberação..." rows={3} />
                )}
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setStep(2)}>← Voltar</Btn>
            <Btn onClick={() => setStep(4)}>Documentos →</Btn>
          </div>
        </div>
      )}

      {/* STEP 4 - Gerar */}
      {step === 4 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>✓</div>
          <h2 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Documentos Prontos</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>{soc?.firma}</p>
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
            {docsAGerar.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, marginBottom: 6, background: '#FAFAF8', borderRadius: 6 }}>
                <span style={{ fontSize: 13 }}>📄 {d}</span>
                <Btn size="sm" onClick={() => baixarDoc(d)} disabled={busy}>{busy ? '...' : 'DOCX ↓'}</Btn>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => setStep(3)}>← Voltar</Btn>
            <Btn onClick={finalizar} disabled={busy}>Concluir e guardar processo</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
