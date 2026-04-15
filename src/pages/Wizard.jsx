import { useEffect, useState } from 'react';
import { listSociedades, createSociedade, getSociedadeByNipc, listProcessos, createProcesso, getAtlasTemplate } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Input, Select, Textarea, Alert, Badge, fmt, fmtD } from '../components/ui.jsx';
import {
  generateAtaSimples, generateContratoCessao, generateAcordoParassocial,
  generateListaSocios, generateDeclaracaoBemProprio
} from '../lib/docs.js';

const fmtEur = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const TIPOS_DELIB = [
  { id: 'aumento_capital',    label: 'Aumento de Capital',         cat: 'capital' },
  { id: 'reducao_capital',    label: 'Redução de Capital',          cat: 'capital' },
  { id: 'cessao_quotas',      label: 'Cessão de Quotas',            cat: 'quotas' },
  { id: 'alteracao_firma',    label: 'Alteração de Firma',          cat: 'pacto', certAdm: true },
  { id: 'alteracao_sede',     label: 'Alteração de Sede',           cat: 'pacto', certAdm: true },
  { id: 'alteracao_objeto',   label: 'Alteração de Objeto Social',  cat: 'pacto', certAdm: true },
  { id: 'aprovacao_contas',   label: 'Aprovação de Contas',         cat: 'contas' },
  { id: 'distribuicao_lucros',label: 'Distribuição de Lucros',      cat: 'contas' },
  { id: 'nomeacao_gerente',   label: 'Nomeação de Gerente',         cat: 'gerencia' },
  { id: 'destituicao_gerente',label: 'Destituição de Gerente',      cat: 'gerencia' },
  { id: 'reducao_capital',    label: 'Redução de Capital',          cat: 'capital' },
  { id: 'transformacao',      label: 'Transformação de Sociedade',  cat: 'vida', certAdm: true },
  { id: 'dissolucao',         label: 'Dissolução Voluntária',       cat: 'vida' },
  { id: 'outro',              label: 'Outra deliberação',           cat: 'outro' },
];
const TIPOS_DELIB_UNIQUE = TIPOS_DELIB.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
const CATS = {
  capital: 'Capital', quotas: 'Quotas', pacto: 'Pacto Social',
  contas: 'Contas', gerencia: 'Gerência', vida: 'Vida da Sociedade', outro: 'Outros',
};
const STEP_NAMES = ['Sociedade', 'Atos do cliente', 'Deliberações', 'Detalhes', 'Gerar'];

// ── Renders clause text from Atlas template, replacing {{vars}} ──────────────
function renderClausula(templateText, vars) {
  if (!templateText) return null;
  return templateText.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `[${key.toUpperCase()}]`);
}

function buildVars(soc, fdMap, did) {
  const meta = fdMap._meta || {};
  const fd = fdMap[did] || {};
  const cedente = soc.socios?.find(s => s.id === fd.cedenteId);
  const cessionario = soc.socios?.find(s => s.id === fd.cessionarioId);
  const socio = soc.socios?.find(s => s.id === fd.socioId);
  const capitalNovo = fd.capital_novo ? Number(fd.capital_novo) : null;
  const capitalFinal = capitalNovo ? fmtEur(capitalNovo) : '[CAPITAL FINAL]';
  const montanteAumento = capitalNovo ? fmtEur(capitalNovo - Number(soc.capital || 0)) : '[MONTANTE]';
  const capitalReducao = fd.red_capital_novo ? Number(fd.red_capital_novo) : null;
  const montanteReducao = capitalReducao ? fmtEur(Number(soc.capital || 0) - capitalReducao) : '[MONTANTE]';

  const novaSedePartes = [fd.nova_morada, fd.nova_freguesia, fd.novo_concelho].filter(Boolean);
  const sedaNova = novaSedePartes.length ? novaSedePartes.join(', ') : (fd.novo_texto || '[NOVA SEDE]');

  const liquidatariosTexto = fd.liquidatario_outro
    ? fd.liquidatario_nome || '[LIQUIDATÁRIO]'
    : (soc.socios?.filter(s => s.is_gerente).map(s => s.nome).filter(Boolean).join(' e ') || soc.socios?.[0]?.nome || '[LIQUIDATÁRIO]');

  return {
    data: meta.data_deliberacao || '[DATA]',
    hora: meta.hora_deliberacao || '[HORA]',
    firma: soc.firma,
    nipc: soc.nipc,
    capital: fmtEur(soc.capital),
    capital_atual: fmtEur(soc.capital),
    capital_novo: capitalFinal,
    montante_aumento: montanteAumento,
    forma_realizacao: fd.forma_realizacao || '[MODALIDADE]',
    prazo_entradas: fd.prazo_entradas || '[PRAZO]',
    iban: fd.iban || '[IBAN]',
    novo_socio_nome: fd.novo_socio_nome || '[NOVO SÓCIO]',
    cedente_nome: cedente ? (cedente.nome || cedente.firma_socio || '[CEDENTE]') : '[CEDENTE]',
    cedente_quota: cedente ? fmtEur(cedente.quota) : '[QUOTA]',
    cedente_pct: cedente ? String(cedente.pct) : '[%]',
    cessionario_nome: cessionario ? (cessionario.nome || cessionario.firma_socio) : (fd.novo_socio_nome || '[CESSIONÁRIO]'),
    valor: fd.valor ? fmtEur(Number(fd.valor)) : '[VALOR]',
    firma_atual: soc.firma,
    nova_firma: fd.nova_firma || '[NOVA FIRMA]',
    cert_codigo: fd.cert_codigo || '[N.º DO CERT. ADMISSIBILIDADE]',
    sede_atual: soc.sede || '[SEDE ATUAL]',
    sede_nova: sedaNova,
    freguesia: fd.nova_freguesia || '[FREGUESIA]',
    concelho: fd.novo_concelho || '[CONCELHO]',
    novo_objeto: fd.novo_objeto || '[NOVO OBJETO SOCIAL]',
    objeto_atual: soc.objeto || '[OBJETO ATUAL]',
    exercicio: fd.exercicio || '[EXERCÍCIO]',
    resultado: fd.resultado ? fmtEur(Number(fd.resultado)) : '[RESULTADO]',
    tipo_resultado: fd.tipo_resultado || '[LUCRO/PREJUÍZO]',
    aplicacao_resultado: fd.aplicacao || '[APLICAÇÃO DOS RESULTADOS]',
    montante: fd.montante ? fmtEur(Number(fd.montante)) : '[MONTANTE]',
    forma_distribuicao: fd.forma_distribuicao || 'proporcionalmente às respetivas quotas',
    prazo_pagamento: fd.prazo_pagamento ? `${fd.prazo_pagamento} dias` : '[PRAZO]',
    socio_nome: socio ? (socio.nome || socio.firma_socio) : (fd.gerente_externo_nome || '[GERENTE]'),
    data_efeito: fd.data_efeito || '[DATA DE EFEITO]',
    fundamento: fd.fundamento || '[FUNDAMENTO]',
    liquidatarios: liquidatariosTexto,
    tipo_atual: soc.tipo || '[TIPO ATUAL]',
    novo_tipo: fd.novo_tipo_sociedade || '[NOVO TIPO]',
    descricao_deliberacao: fd.detalhes || '[DESCRIÇÃO DA DELIBERAÇÃO]',
    motivo: fd.motivo_reducao || 'cobertura de prejuízos',
    capital_reducao_novo: capitalReducao ? fmtEur(capitalReducao) : '[CAPITAL FINAL]',
    montante_reducao: montanteReducao,
  };
}

export default function Wizard({ onCancel, onDone }) {
  const { profissional } = useAuth();
  const [step, setStep] = useState(0);
  const [socs, setSocs] = useState([]);
  const [soc, setSoc] = useState(null);
  const [nipcInput, setNipcInput] = useState('');
  const [novoSoc, setNovoSoc] = useState(null);
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [atosCliente, setAtosCliente] = useState([]);
  const [atlasTemplates, setAtlasTemplates] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { listSociedades().then(setSocs); }, []);

  // Load Atlas templates whenever deliberations change
  useEffect(() => {
    selDel.forEach(async (did) => {
      if (!atlasTemplates[did]) {
        const t = await getAtlasTemplate(did);
        if (t) setAtlasTemplates(prev => ({ ...prev, [did]: t }));
      }
    });
  }, [selDel]);

  const selectSoc = async (s) => {
    setSoc(s);
    if (s?.id) setAtosCliente(await listProcessos(s.id));
  };

  const procurar = async () => {
    const clean = nipcInput.replace(/[\s.]/g, '');
    if (clean.length < 9) return;
    const found = await getSociedadeByNipc(clean);
    if (found) selectSoc(found);
    else setNovoSoc({ nipc: clean, firma: '', tipo: 'Sociedade por Quotas', sede: '', capital: 0, socios: [{ letra: 'A', quota: 0, pct: 100, tipo_pessoa: 'singular' }], _new: true });
  };

  const criarESelecionar = async () => {
    const created = await createSociedade(novoSoc, profissional?.id);
    selectSoc(created);
    setNovoSoc(null);
  };

  const togDel = id => setSelDel(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);
  const upd = (did, k, v) => setFdMap(p => ({ ...p, [did]: { ...(p[did] || {}), [k]: v } }));
  const updMeta = (k, v) => upd('_meta', k, v);
  const getFd = did => fdMap[did] || {};
  const meta = getFd('_meta');

  const docsAGerar = (() => {
    const out = ['Ata', 'Lista de Sócios'];
    selDel.forEach(did => {
      const fd = getFd(did);
      if (did === 'cessao_quotas') {
        out.push('Contrato de Cessão');
        if (fd.gerar_parassocial) out.push('Acordo Parassocial');
        if (fd.gerar_bem_proprio) out.push('Declaração de Bem Próprio');
      }
    });
    return [...new Set(out)];
  })();

  const finalizar = async () => {
    setBusy(true);
    try {
      await createProcesso({
        sociedade_id: soc.id,
        titulo: `Deliberação de ${meta.data_deliberacao || new Date().toLocaleDateString('pt-PT')}`,
        descricao: selDel.map(d => TIPOS_DELIB_UNIQUE.find(t => t.id === d)?.label).join(', '),
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
      const dataDelib = meta.data_deliberacao || '[DATA]';
      const horaDelib = meta.hora_deliberacao || '[HORA]';
      const numAta = meta.numero_ata || '[N.º]';

      if (nome === 'Ata') {
        // Build clausulas from Atlas templates with variable substitution
        const clausulas = selDel.map(did => {
          const t = TIPOS_DELIB_UNIQUE.find(x => x.id === did);
          const template = atlasTemplates[did];
          const vars = buildVars(soc, fdMap, did);
          const texto = template?.clausula_texto
            ? renderClausula(template.clausula_texto, vars)
            : null;
          return { label: t?.label || did, texto };
        });
        await generateAtaSimples(soc, { numero: numAta, data: dataDelib, hora: horaDelib, clausulas });
      }
      else if (nome === 'Lista de Sócios') {
        await generateListaSocios(soc, { data: dataDelib });
      }
      else if (nome === 'Contrato de Cessão') {
        const fd = getFd('cessao_quotas');
        await generateContratoCessao(soc, { cedenteId: fd.cedenteId, cessionarioId: fd.cessionarioId, valor: fd.valor, local: fd.local || 'Lisboa', data: dataDelib });
      }
      else if (nome === 'Acordo Parassocial') {
        const fd = getFd('cessao_quotas');
        await generateAcordoParassocial(soc, { limite_inv: fd.limite_inv, limite_cont: fd.limite_cont });
      }
      else if (nome === 'Declaração de Bem Próprio') {
        const fd = getFd('cessao_quotas');
        await generateDeclaracaoBemProprio(soc, { socioId: fd.bem_proprio_socio });
      }
    } catch (e) { alert('Erro: ' + e.message); }
    setBusy(false);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="topbar-brand-tag">CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 28, marginTop: 4 }}>Nova deliberação</h1>
        </div>
        <Btn variant="ghost" onClick={onCancel}>✕ Cancelar</Btn>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {STEP_NAMES.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_NAMES.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i <= step ? '#8B7355' : '#E5E7EB', color: i <= step ? '#fff' : '#9CA3AF' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i <= step ? '#1F2937' : '#9CA3AF' }}>{s}</span>
            </div>
            {i < STEP_NAMES.length - 1 && <div style={{ flex: 1, height: 1, margin: '0 12px', background: i < step ? '#8B7355' : '#E5E7EB' }} />}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Sociedade ── */}
      {step === 0 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Identificar a sociedade</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
            <Input label="NIPC" value={nipcInput} onChange={setNipcInput} placeholder="Ex: 516234567" style={{ flex: 1 }} />
            <Btn onClick={procurar}>Procurar</Btn>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Ou selecionar das existentes:</div>
          <Select value={soc?.id || ''} onChange={id => { const found = socs.find(s => s.id === id); if (found) selectSoc(found); }}
            options={socs.map(s => ({ v: s.id, l: `${s.firma} (${s.nipc})` }))} placeholder="Escolher sociedade existente..." />
          {soc && (
            <div style={{ marginTop: 14, padding: 14, background: '#FAFAF8', borderRadius: 8 }}>
              <div className="card-title">{soc.firma}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>NIPC {soc.nipc} · {soc.tipo} · Capital {fmt(soc.capital)}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{soc.socios?.length || 0} sócios registados</div>
            </div>
          )}
          {novoSoc && (
            <div style={{ marginTop: 16, padding: 16, background: '#FEF8E7', borderRadius: 8, border: '1px solid #FCD34D' }}>
              <Alert variant="warn">Sociedade não encontrada. Criar nova:</Alert>
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

      {/* ── STEP 1: Atos do cliente ── */}
      {step === 1 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Atos realizados para {soc?.firma}</h3>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Histórico de deliberações anteriores para este cliente.</p>
          {atosCliente.length === 0
            ? <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum ato anterior registado.</div>
            : atosCliente.map(p => (
              <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.titulo}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{p.descricao}</div>
                    {p.documentos_gerados?.length > 0 && <div style={{ fontSize: 11, color: '#B8976A', marginTop: 3 }}>📄 {p.documentos_gerados.join(' · ')}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div>{fmtD(p.data_processo)}</div>
                    <div>{p.profissional_nome}</div>
                  </div>
                </div>
              </div>
            ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => setStep(0)}>← Voltar</Btn>
            <Btn onClick={() => setStep(2)}>Continuar →</Btn>
          </div>
        </div>
      )}

      {/* ── STEP 2: Deliberações ── */}
      {step === 2 && (
        <div className="card">
          <h3 className="serif" style={{ fontSize: 18, marginBottom: 16 }}>Selecionar deliberações</h3>
          {Object.entries(CATS).map(([cid, cl]) => {
            const items = TIPOS_DELIB_UNIQUE.filter(t => t.cat === cid);
            return (
              <div key={cid} style={{ marginBottom: 16 }}>
                <div className="field-label" style={{ marginBottom: 6 }}>{cl}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {items.map(t => {
                    const sel = selDel.includes(t.id);
                    return (
                      <div key={t.id} onClick={() => togDel(t.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                        borderRadius: 6, cursor: 'pointer',
                        border: sel ? '2px solid #8B7355' : '1px solid #E5E7EB',
                        background: sel ? '#FAF6EE' : '#fff',
                      }}>
                        <div style={{ width: 18, height: 18, borderRadius: 3, border: sel ? 'none' : '2px solid #D1D5DB', background: sel ? '#8B7355' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sel && '✓'}</div>
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

      {/* ── STEP 3: Detalhes ── */}
      {step === 3 && (
        <div>
          {/* Data/hora da assembleia — sempre no topo */}
          <div className="card" style={{ marginBottom: 16, background: '#FAF6EE', border: '1px solid #E9D8AB' }}>
            <h3 className="serif" style={{ fontSize: 16, marginBottom: 14, color: '#78582A' }}>Data e hora das deliberações</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Input label="Número da ata" value={meta.numero_ata} onChange={v => updMeta('numero_ata', v)} placeholder="Ex: 12" />
              <Input label="Data" value={meta.data_deliberacao} onChange={v => updMeta('data_deliberacao', v)} placeholder="Ex: 15 de abril de 2026" />
              <Input label="Hora" value={meta.hora_deliberacao} onChange={v => updMeta('hora_deliberacao', v)} placeholder="Ex: 14:30" />
            </div>
            {atlasTemplates[selDel[0]] && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#78582A' }}>
                ✓ Texto do Atlas carregado — a ata será gerada com as cláusulas configuradas.
              </div>
            )}
          </div>

          {selDel.map(did => {
            const t = TIPOS_DELIB_UNIQUE.find(x => x.id === did);
            const fd = getFd(did);
            const socios = soc.socios || [];

            return (
              <div key={did} className="card" style={{ marginBottom: 16 }}>
                <h3 className="serif" style={{ fontSize: 17, marginBottom: 16 }}>{t?.label}</h3>

                {/* ── AUMENTO DE CAPITAL ── */}
                {did === 'aumento_capital' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <Input label="Capital atual (€)" value={fmt(soc.capital)} disabled />
                      <Input label="★ Capital final (€)" type="number" value={fd.capital_novo} onChange={v => upd(did, 'capital_novo', v)} required />
                      <Input label="Aumento (€)" value={fd.capital_novo ? fmt(Number(fd.capital_novo) - Number(soc.capital || 0)) : ''} disabled />
                    </div>
                    <Select label="★ Modalidade do aumento" value={fd.forma_realizacao} onChange={v => upd(did, 'forma_realizacao', v)} required
                      options={[
                        { v: 'novas entradas em dinheiro', l: 'Novas entradas em dinheiro' },
                        { v: 'incorporação de reservas', l: 'Incorporação de reservas (art. 91.º CSC)' },
                        { v: 'conversão de suprimentos', l: 'Conversão de suprimentos (art. 87.º, n.º 4 CSC)' },
                        { v: 'misto (suprimentos e novas entradas em dinheiro)', l: 'Misto: suprimentos + dinheiro' },
                      ]} />

                    {(fd.forma_realizacao === 'novas entradas em dinheiro' || fd.forma_realizacao?.includes('misto')) && (
                      <div style={{ padding: 14, background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0369A1', marginBottom: 10 }}>ENTRADAS EM DINHEIRO</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Select label="★ Quem participa no aumento?" value={fd.participantes} onChange={v => upd(did, 'participantes', v)}
                            options={[
                              { v: 'socios_proporcional', l: 'Sócios atuais, proporcionalmente às quotas' },
                              { v: 'novo_socio', l: 'Novo sócio (entrada de terceiro)' },
                              { v: 'socios_e_novo', l: 'Sócios atuais + novo sócio' },
                              { v: 'um_socio', l: 'Apenas um sócio (os restantes renunciam)' },
                            ]} />
                          <Select label="Tratamento do direito de preferência (art. 266.º CSC)" value={fd.direito_preferencia} onChange={v => upd(did, 'direito_preferencia', v)}
                            options={[
                              { v: 'exercicio_proporc', l: 'Exercício proporcional por todos os sócios' },
                              { v: 'renuncia_ata', l: 'Sócios renunciam em ata (mais simples)' },
                              { v: 'renuncia_declaracoes', l: 'Sócios renunciam por declarações separadas' },
                            ]} />
                          <Input label="Prazo para realização das entradas" value={fd.prazo_entradas} onChange={v => upd(did, 'prazo_entradas', v)} placeholder="Ex: 30 dias após a deliberação" />
                          <Input label="IBAN da sociedade" value={fd.iban} onChange={v => upd(did, 'iban', v)} placeholder="PT50..." />
                        </div>
                        {(fd.participantes === 'novo_socio' || fd.participantes === 'socios_e_novo') && (
                          <div style={{ marginTop: 12, padding: 12, background: '#FEFCE8', borderRadius: 6, border: '1px solid #FDE68A' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F', marginBottom: 8 }}>IDENTIFICAÇÃO DO NOVO SÓCIO</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Input label="Nome completo" value={fd.novo_socio_nome} onChange={v => upd(did, 'novo_socio_nome', v)} required />
                              <Input label="NIF" value={fd.novo_socio_nif} onChange={v => upd(did, 'novo_socio_nif', v)} />
                              <Input label="Montante de entrada (€)" type="number" value={fd.novo_socio_entrada} onChange={v => upd(did, 'novo_socio_entrada', v)} />
                              <Input label="CC n.º" value={fd.novo_socio_cc} onChange={v => upd(did, 'novo_socio_cc', v)} />
                              <Input label="Morada" value={fd.novo_socio_morada} onChange={v => upd(did, 'novo_socio_morada', v)} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {fd.forma_realizacao === 'incorporação de reservas' && (
                      <div style={{ padding: 14, background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0369A1', marginBottom: 10 }}>INCORPORAÇÃO DE RESERVAS (Art. 91.º CSC)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Select label="Balanço de suporte" value={fd.balanco_tipo} onChange={v => upd(did, 'balanco_tipo', v)}
                            options={[
                              { v: 'exercicio', l: 'Balanço do exercício (aprovado há menos de 6 meses)' },
                              { v: 'especial', l: 'Balanço especial de incorporação' },
                            ]} />
                          <Input label="Tipo de reservas a incorporar" value={fd.tipo_reservas} onChange={v => upd(did, 'tipo_reservas', v)} placeholder="Ex: reservas livres" />
                        </div>
                        <Alert variant="info" style={{ marginTop: 10 }}>Se as contas foram aprovadas há mais de 6 meses, é obrigatório balanço especial (art. 91.º, n.º 2 CSC).</Alert>
                      </div>
                    )}

                    {(fd.forma_realizacao === 'conversão de suprimentos' || fd.forma_realizacao?.includes('misto')) && (
                      <div style={{ padding: 14, background: '#F0FDF4', borderRadius: 8, border: '1px solid #86EFAC' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#14532D', marginBottom: 10 }}>CONVERSÃO DE SUPRIMENTOS (Art. 87.º, n.º 4 e Art. 89.º, n.º 4 CSC)</div>
                        {socios.map(s => (
                          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <div style={{ fontSize: 13 }}>{s.nome || s.firma_socio || `Sócio ${s.letra}`}</div>
                            <Input label="Montante de suprimentos a converter (€)" type="number" value={fd[`sup_${s.id}`]} onChange={v => upd(did, `sup_${s.id}`, v)} />
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: '#14532D', marginTop: 6 }}>⚠ Necessária declaração do Contabilista Certificado ou ROC (art. 89.º, n.º 4 CSC)</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── REDUÇÃO DE CAPITAL ── */}
                {did === 'reducao_capital' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <Input label="Capital atual (€)" value={fmt(soc.capital)} disabled />
                      <Input label="★ Capital final (€)" type="number" value={fd.red_capital_novo} onChange={v => upd(did, 'red_capital_novo', v)} required />
                      <Input label="Redução (€)" value={fd.red_capital_novo ? fmt(Number(soc.capital) - Number(fd.red_capital_novo)) : ''} disabled />
                    </div>
                    <Select label="★ Motivo da redução" value={fd.motivo_reducao} onChange={v => upd(did, 'motivo_reducao', v)} required
                      options={[
                        { v: 'cobertura de prejuízos', l: 'Cobertura de prejuízos acumulados (sem reembolso)' },
                        { v: 'libertação de excesso de capital', l: 'Libertação de excesso de capital' },
                        { v: 'reembolso de entradas aos sócios', l: 'Reembolso de entradas aos sócios' },
                      ]} />
                    {(fd.motivo_reducao === 'reembolso de entradas aos sócios') && (
                      <Alert variant="warn">Na redução com reembolso, os credores têm 1 mês após publicação do registo para requerer garantias (art. 96.º CSC). A regra: situação líquida após redução deve exceder o novo capital em ≥ 20% (art. 95.º CSC).</Alert>
                    )}
                  </div>
                )}

                {/* ── CESSÃO DE QUOTAS ── */}
                {did === 'cessao_quotas' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Select label="★ Cedente" value={fd.cedenteId} onChange={v => upd(did, 'cedenteId', v)} required
                        options={socios.map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || s.firma_socio || '(sem nome)'}` }))} />
                      <Select label="★ Cessionário" value={fd.tipo_cessionario} onChange={v => upd(did, 'tipo_cessionario', v)}
                        options={[
                          { v: 'socio_existente', l: 'Sócio existente da sociedade' },
                          { v: 'terceiro', l: 'Terceiro (novo / externo)' },
                        ]} />
                    </div>
                    {fd.tipo_cessionario === 'socio_existente' && (
                      <Select label="Qual sócio?" value={fd.cessionarioId} onChange={v => upd(did, 'cessionarioId', v)}
                        options={socios.filter(s => s.id !== fd.cedenteId).map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || s.firma_socio || '(sem nome)'}` }))} />
                    )}
                    {fd.tipo_cessionario === 'terceiro' && (
                      <div style={{ padding: 12, background: '#FEFCE8', borderRadius: 6, border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F', marginBottom: 8 }}>IDENTIFICAÇÃO DO CESSIONÁRIO</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Input label="Nome completo" value={fd.novo_socio_nome} onChange={v => upd(did, 'novo_socio_nome', v)} required />
                          <Input label="NIF" value={fd.novo_socio_nif} onChange={v => upd(did, 'novo_socio_nif', v)} />
                          <Input label="CC n.º" value={fd.novo_socio_cc} onChange={v => upd(did, 'novo_socio_cc', v)} />
                          <Input label="Estado civil" value={fd.novo_socio_estado_civil} onChange={v => upd(did, 'novo_socio_estado_civil', v)} />
                          <Input label="Morada" value={fd.novo_socio_morada} onChange={v => upd(did, 'novo_socio_morada', v)} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Input label="★ Valor da cessão (€)" type="number" value={fd.valor} onChange={v => upd(did, 'valor', v)} required />
                      <Input label="Local da cessão" value={fd.local} onChange={v => upd(did, 'local', v)} placeholder="Ex: Leiria" />
                      <Select label="Consentimento dos demais sócios" value={fd.consentimento} onChange={v => upd(did, 'consentimento', v)}
                        options={[
                          { v: 'ata', l: 'Constará em ata (sócios presentes renunciam)' },
                          { v: 'livre', l: 'Cessão livre (entre sócios ou familiares — art. 228.º, n.º 2 CSC)' },
                          { v: 'declaracoes', l: 'Declarações separadas de renúncia a preferência' },
                        ]} />
                    </div>
                    <div style={{ padding: 14, background: '#FDF8F0', borderRadius: 8, border: '1px solid #E9D8AB' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#78582A', marginBottom: 10 }}>Documentos complementares</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                          <input type="checkbox" checked={!!fd.gerar_contrato} onChange={e => upd(did, 'gerar_contrato', e.target.checked)} />
                          Contrato de Cessão de Quotas
                        </label>
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                          <input type="checkbox" checked={!!fd.gerar_parassocial} onChange={e => upd(did, 'gerar_parassocial', e.target.checked)} />
                          Acordo Parassocial
                        </label>
                        {fd.gerar_parassocial && (
                          <div style={{ paddingLeft: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <Input label="Limite para investimentos (€)" type="number" value={fd.limite_inv} onChange={v => upd(did, 'limite_inv', v)} placeholder="50000" />
                            <Input label="Limite para contratos (€)" type="number" value={fd.limite_cont} onChange={v => upd(did, 'limite_cont', v)} placeholder="85000" />
                          </div>
                        )}
                        <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                          <input type="checkbox" checked={!!fd.gerar_bem_proprio} onChange={e => upd(did, 'gerar_bem_proprio', e.target.checked)} />
                          Declaração de Bem Próprio (sócio casado em comunhão)
                        </label>
                        {fd.gerar_bem_proprio && (
                          <div style={{ paddingLeft: 22 }}>
                            <Select label="Sócio casado em comunhão" value={fd.bem_proprio_socio} onChange={v => upd(did, 'bem_proprio_socio', v)}
                              options={socios.filter(s => s.estado_civil === 'casado' && (s.regime_bens === 'comunhao_adquiridos' || s.regime_bens === 'comunhao_geral')).map(s => ({ v: s.id, l: s.nome }))} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ALTERAÇÃO DE FIRMA ── */}
                {did === 'alteracao_firma' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input label="Firma atual" value={soc.firma} disabled />
                    <Input label="★ Nova firma" value={fd.nova_firma} onChange={v => upd(did, 'nova_firma', v)} required placeholder="Ex: Empresa Nova, Lda." />
                    <div style={{ padding: 12, background: '#FEF8E7', borderRadius: 6, border: '1px solid #FCD34D' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F', marginBottom: 8 }}>Certificado de Admissibilidade (obrigatório)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Select label="Certificado obtido?" value={fd.tem_cert} onChange={v => upd(did, 'tem_cert', v)}
                          options={[{ v: 'sim', l: 'Sim — tenho o código' }, { v: 'nao', l: 'Não — ainda a obter' }]} />
                        {fd.tem_cert === 'sim' && (
                          <Input label="★ Código do Certificado" value={fd.cert_codigo} onChange={v => upd(did, 'cert_codigo', v)} placeholder="Ex: 1475-1647-4386" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ALTERAÇÃO DE SEDE ── */}
                {did === 'alteracao_sede' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input label="Sede atual" value={soc.sede} disabled />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <Input label="★ Nova morada (rua, n.º, código postal)" value={fd.nova_morada} onChange={v => upd(did, 'nova_morada', v)} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Input label="Freguesia" value={fd.nova_freguesia} onChange={v => upd(did, 'nova_freguesia', v)} />
                      <Input label="Concelho" value={fd.novo_concelho} onChange={v => upd(did, 'novo_concelho', v)} />
                    </div>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.muda_conservatoria} onChange={e => upd(did, 'muda_conservatoria', e.target.checked)} />
                      Muda de circunscrição de Conservatória do Registo Comercial
                    </label>
                  </div>
                )}

                {/* ── ALTERAÇÃO DE OBJETO ── */}
                {did === 'alteracao_objeto' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Textarea label="Objeto atual" value={soc.objeto} disabled rows={2} />
                    <Textarea label="★ Novo objeto social" value={fd.novo_objeto} onChange={v => upd(did, 'novo_objeto', v)} required rows={4}
                      placeholder="Ex: A importação, exportação e comércio por grosso e a retalho de..." />
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.atividade_regulada} onChange={e => upd(did, 'atividade_regulada', e.target.checked)} />
                      Atividade regulada (banca, seguros, mediação, saúde, turismo, etc.) — verificar licenças
                    </label>
                    {fd.atividade_regulada && (
                      <Alert variant="warn">Atividades reguladas podem exigir autorização prévia da entidade supervisora antes do registo.</Alert>
                    )}
                  </div>
                )}

                {/* ── APROVAÇÃO DE CONTAS ── */}
                {did === 'aprovacao_contas' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input label="★ Exercício" value={fd.exercicio} onChange={v => upd(did, 'exercicio', v)} placeholder="2025" required />
                    <Select label="★ Resultado do exercício" value={fd.tipo_resultado} onChange={v => upd(did, 'tipo_resultado', v)} required
                      options={[{ v: 'Lucro', l: 'Lucro' }, { v: 'Prejuízo', l: 'Prejuízo' }, { v: 'Resultado nulo', l: 'Resultado nulo' }]} />
                    <Input label="Montante do resultado (€)" type="number" value={fd.resultado} onChange={v => upd(did, 'resultado', v)} />
                    <Select label="Aplicação dos resultados" value={fd.aplicacao} onChange={v => upd(did, 'aplicacao', v)}
                      options={[
                        { v: 'transição para o exercício seguinte', l: 'Transição para exercício seguinte' },
                        { v: 'distribuição aos sócios', l: 'Distribuição de lucros aos sócios' },
                        { v: 'reforço de reservas', l: 'Reforço de reservas' },
                        { v: 'cobertura de prejuízos anteriores', l: 'Cobertura de prejuízos anteriores' },
                      ]} />
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.houve_roc} onChange={e => upd(did, 'houve_roc', e.target.checked)} />
                      Houve intervenção de ROC
                    </label>
                  </div>
                )}

                {/* ── DISTRIBUIÇÃO DE LUCROS ── */}
                {did === 'distribuicao_lucros' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input label="★ Exercício" value={fd.exercicio} onChange={v => upd(did, 'exercicio', v)} placeholder="2025" required />
                    <Input label="★ Montante a distribuir (€)" type="number" value={fd.montante} onChange={v => upd(did, 'montante', v)} required />
                    <Select label="★ Forma de distribuição" value={fd.forma_distribuicao} onChange={v => upd(did, 'forma_distribuicao', v)} required
                      options={[
                        { v: 'proporcionalmente às respetivas quotas', l: 'Proporcionalmente às quotas' },
                        { v: 'em partes iguais entre os sócios', l: 'Em partes iguais' },
                        { v: 'conforme acordo entre os sócios', l: 'Conforme acordo entre sócios' },
                      ]} />
                    <Input label="Prazo de pagamento" value={fd.prazo_pagamento} onChange={v => upd(did, 'prazo_pagamento', v)} placeholder="Ex: 30 dias" />
                  </div>
                )}

                {/* ── NOMEAÇÃO DE GERENTE ── */}
                {did === 'nomeacao_gerente' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Select label="★ O gerente é:" value={fd.tipo_gerente} onChange={v => upd(did, 'tipo_gerente', v)}
                      options={[
                        { v: 'socio', l: 'Sócio da sociedade' },
                        { v: 'terceiro', l: 'Terceiro (não é sócio)' },
                      ]} />
                    {fd.tipo_gerente === 'socio' && (
                      <Select label="★ Sócio" value={fd.socioId} onChange={v => upd(did, 'socioId', v)} required
                        options={socios.map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || s.firma_socio || '(sem nome)'}` }))} />
                    )}
                    {fd.tipo_gerente === 'terceiro' && (
                      <div style={{ padding: 12, background: '#FAFAF8', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>IDENTIFICAÇÃO DO NOVO GERENTE</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Input label="Nome completo" value={fd.gerente_externo_nome} onChange={v => upd(did, 'gerente_externo_nome', v)} required />
                          <Input label="NIF" value={fd.gerente_externo_nif} onChange={v => upd(did, 'gerente_externo_nif', v)} />
                          <Input label="CC n.º" value={fd.gerente_externo_cc} onChange={v => upd(did, 'gerente_externo_cc', v)} />
                          <Input label="Morada" value={fd.gerente_externo_morada} onChange={v => upd(did, 'gerente_externo_morada', v)} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Input label="★ Data de início de funções" value={fd.data_efeito} onChange={v => upd(did, 'data_efeito', v)} placeholder="DD/MM/AAAA" />
                    </div>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.altera_forma_obrigar} onChange={e => upd(did, 'altera_forma_obrigar', e.target.checked)} />
                      Esta nomeação altera a forma de obrigar / cláusula da gerência no contrato
                    </label>
                    {fd.altera_forma_obrigar && (
                      <Textarea label="Nova redação da cláusula da gerência" value={fd.nova_clausula_gerencia} onChange={v => upd(did, 'nova_clausula_gerencia', v)} rows={3} placeholder="Art. X (Gerência) — 1. A sociedade é gerida por..." />
                    )}
                  </div>
                )}

                {/* ── DESTITUIÇÃO DE GERENTE ── */}
                {did === 'destituicao_gerente' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Select label="★ Gerente a destituir" value={fd.socioId} onChange={v => upd(did, 'socioId', v)} required
                      options={socios.map(s => ({ v: s.id, l: `${s.nome || s.firma_socio || `Sócio ${s.letra}`}` }))} />
                    <Input label="★ Data de efeito" value={fd.data_efeito} onChange={v => upd(did, 'data_efeito', v)} placeholder="DD/MM/AAAA" />
                    <div style={{ gridColumn: '1/-1' }}>
                      <Select label="★ Fundamento" value={fd.fundamento} onChange={v => upd(did, 'fundamento', v)} required
                        options={[
                          { v: 'mútuo acordo', l: 'Mútuo acordo entre as partes' },
                          { v: 'justa causa', l: 'Justa causa (art. 257.º, n.º 6 CSC — sem indemnização)' },
                          { v: 'sem justa causa (com indemnização)', l: 'Sem justa causa — com indemnização (art. 257.º, n.º 7 CSC)' },
                        ]} />
                    </div>
                    {fd.fundamento === 'sem justa causa (com indemnização)' && (
                      <div style={{ gridColumn: '1/-1' }}>
                        <Alert variant="warn">Destituição sem justa causa: a sociedade fica obrigada ao pagamento de indemnização correspondente aos danos causados (art. 257.º, n.º 7 CSC).</Alert>
                      </div>
                    )}
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                        <input type="checkbox" checked={!!fd.tem_contrato_trabalho} onChange={e => upd(did, 'tem_contrato_trabalho', e.target.checked)} />
                        O gerente tem contrato de trabalho com a sociedade — verificar implicações laborais
                      </label>
                    </div>
                  </div>
                )}

                {/* ── TRANSFORMAÇÃO ── */}
                {did === 'transformacao' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Input label="Tipo atual" value={soc.tipo} disabled />
                      <Select label="★ Novo tipo" value={fd.novo_tipo_sociedade} onChange={v => upd(did, 'novo_tipo_sociedade', v)} required
                        options={[
                          { v: 'Sociedade Anónima', l: 'Sociedade Anónima (S.A.)' },
                          { v: 'Sociedade por Quotas', l: 'Sociedade por Quotas (Lda.)' },
                          { v: 'Sociedade em Nome Coletivo', l: 'Soc. em Nome Coletivo' },
                        ]} />
                    </div>
                    <div style={{ padding: 12, background: '#FEF8E7', borderRadius: 6, border: '1px solid #FCD34D' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F', marginBottom: 8 }}>Certificado de Admissibilidade (obrigatório — nova firma/tipo)</div>
                      <Input label="★ Código do Certificado" value={fd.cert_codigo} onChange={v => upd(did, 'cert_codigo', v)} placeholder="Ex: 1475-1647-4386" />
                    </div>
                    <Alert variant="info">A transformação exige: relatório da gerência + balanço (aprovado há menos de 6 meses) + projeto dos novos estatutos (art. 132.º CSC). Deliberação em 3 pontos separados (art. 134.º CSC).</Alert>
                  </div>
                )}

                {/* ── DISSOLUÇÃO ── */}
                {did === 'dissolucao' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Select label="★ Fundamento da dissolução" value={fd.fundamento_dissolucao} onChange={v => upd(did, 'fundamento_dissolucao', v)} required
                      options={[
                        { v: 'por vontade dos sócios', l: 'Por vontade dos sócios (art. 141.º, al. b) CSC)' },
                        { v: 'por decurso do prazo', l: 'Por decurso do prazo fixado no contrato' },
                        { v: 'por realização completa do objeto', l: 'Por realização completa do objeto social' },
                      ]} />
                    <div style={{ padding: 12, background: '#FAFAF8', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>LIQUIDATÁRIO(S)</div>
                      <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center', marginBottom: 8 }}>
                        <input type="checkbox" checked={!!fd.liquidatario_outro} onChange={e => upd(did, 'liquidatario_outro', e.target.checked)} />
                        Nomear liquidatário diferente dos gerentes atuais
                      </label>
                      {fd.liquidatario_outro && (
                        <Input label="Nome do liquidatário" value={fd.liquidatario_nome} onChange={v => upd(did, 'liquidatario_nome', v)} />
                      )}
                      {!fd.liquidatario_outro && (
                        <div style={{ fontSize: 12, color: '#6B7280' }}>Por defeito, os gerentes atuais passam a liquidatários (art. 151.º, n.º 1 CSC).</div>
                      )}
                    </div>
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.partilha_imediata} onChange={e => upd(did, 'partilha_imediata', e.target.checked)} />
                      Partilha imediata — sociedade sem dívidas (art. 147.º CSC)
                    </label>
                    {fd.partilha_imediata && (
                      <Alert variant="warn">Na partilha imediata, os sócios ficam solidariamente responsáveis por dívidas fiscais ainda não exigíveis (art. 147.º, n.º 2 CSC).</Alert>
                    )}
                    <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!fd.sem_dividas_fiscais} onChange={e => upd(did, 'sem_dividas_fiscais', e.target.checked)} />
                      Confirmado: não existem dívidas fiscais nem contributivas
                    </label>
                  </div>
                )}

                {/* ── OUTRO ── */}
                {did === 'outro' && (
                  <Textarea label="★ Descrição da deliberação" value={fd.detalhes} onChange={v => upd(did, 'detalhes', v)} rows={5}
                    placeholder="Descrever detalhadamente os termos e condições da deliberação..." required />
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

      {/* ── STEP 4: Gerar ── */}
      {step === 4 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>✓</div>
          <h2 className="serif" style={{ fontSize: 22, marginBottom: 4 }}>Documentos prontos</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{soc?.firma}</p>
          {meta.data_deliberacao && (
            <p style={{ fontSize: 12, color: '#B8976A', marginBottom: 20 }}>
              {meta.data_deliberacao}{meta.hora_deliberacao ? ` · ${meta.hora_deliberacao}h` : ''} · Ata n.º {meta.numero_ata || '—'}
            </p>
          )}
          {!atlasTemplates[selDel[0]] && selDel.length > 0 && (
            <div style={{ maxWidth: 480, margin: '0 auto 16px', padding: 10, background: '#FEF8E7', borderRadius: 6, fontSize: 12, color: '#78350F' }}>
              ⚠ Template do Atlas não carregado — a ata usará texto genérico. Guarda primeiro os templates no Atlas.
            </div>
          )}
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
