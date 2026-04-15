import { useEffect, useState } from 'react';
import { listSociedades } from '../lib/db.js';
import { Btn, Select, Empty, Alert, Input } from '../components/ui.jsx';
import { generateAtaSimples, generateContratoCessao, generateAcordoParassocial, generateListaSocios, generateDeclaracaoBemProprio } from '../lib/docs.js';

const TIPOS_DOC = [
  { v: 'ata', l: 'Ata simples', desc: 'Ata em formato editável (preencher pontos)' },
  { v: 'lista', l: 'Lista de Sócios', desc: 'Lista atual da sociedade' },
  { v: 'cessao', l: 'Contrato de Cessão de Quotas', desc: 'Contrato standalone' },
  { v: 'parassocial', l: 'Acordo Parassocial', desc: 'Modelo TRIQBRIQ — 20 cláusulas' },
  { v: 'bem_proprio', l: 'Declaração de Bem Próprio', desc: 'Art. 1723.º al. c) CC' },
];

export default function DocumentosAvulsos() {
  const [socs, setSocs] = useState([]);
  const [socId, setSocId] = useState('');
  const [tipoDoc, setTipoDoc] = useState('');
  const [extra, setExtra] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { listSociedades().then(setSocs); }, []);
  const soc = socs.find(s => s.id === socId);

  const gerar = async () => {
    if (!soc || !tipoDoc) return;
    setBusy(true);
    try {
      if (tipoDoc === 'ata') await generateAtaSimples(soc, extra);
      else if (tipoDoc === 'lista') await generateListaSocios(soc);
      else if (tipoDoc === 'cessao') await generateContratoCessao(soc, extra);
      else if (tipoDoc === 'parassocial') await generateAcordoParassocial(soc, extra);
      else if (tipoDoc === 'bem_proprio') await generateDeclaracaoBemProprio(soc, extra);
    } catch (e) { alert('Erro: ' + e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="topbar-brand-tag">CORPORATE P&A</div>
        <h1 className="serif" style={{ fontSize: 30, marginTop: 4 }}>Documentos avulsos</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Gerar documentos sem passar pelo wizard de deliberação.</p>
      </div>

      {socs.length === 0 ? (
        <Empty title="Adicione primeiro uma sociedade." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <h2 className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Selecionar</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Select label="Sociedade" value={socId} onChange={setSocId} options={socs.map(s => ({ v: s.id, l: `${s.firma} (${s.nipc})` }))} required />
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Tipo de documento</div>
                {TIPOS_DOC.map(t => (
                  <div key={t.v} onClick={() => setTipoDoc(t.v)} style={{ padding: 12, marginBottom: 6, borderRadius: 6, border: tipoDoc === t.v ? '2px solid #8B7355' : '1px solid #E5E7EB', background: tipoDoc === t.v ? '#FAF6EE' : '#fff', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: tipoDoc === t.v ? 600 : 500 }}>{t.l}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Configurar</h2>
            {!tipoDoc ? <p style={{ color: '#9CA3AF', fontSize: 13 }}>Selecione o tipo de documento.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tipoDoc === 'ata' && (
                  <>
                    <Input label="Número da ata" value={extra.numero} onChange={v => setExtra({ ...extra, numero: v })} placeholder="Ex: 12" />
                    <Input label="Data" value={extra.data} onChange={v => setExtra({ ...extra, data: v })} placeholder="Ex: 15 de abril de 2026" />
                  </>
                )}
                {tipoDoc === 'cessao' && (
                  <>
                    <Select label="Cedente" value={extra.cedenteId} onChange={v => setExtra({ ...extra, cedenteId: v })} options={(soc?.socios || []).map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || '(sem nome)'}` }))} />
                    <Select label="Cessionário" value={extra.cessionarioId} onChange={v => setExtra({ ...extra, cessionarioId: v })} options={(soc?.socios || []).map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || '(sem nome)'}` }))} />
                    <Input label="Valor da cessão (€)" type="number" value={extra.valor} onChange={v => setExtra({ ...extra, valor: v })} />
                    <Input label="Local" value={extra.local} onChange={v => setExtra({ ...extra, local: v })} placeholder="Ex: Lisboa" />
                  </>
                )}
                {tipoDoc === 'parassocial' && (
                  <>
                    <Input label="Limite investimentos (€)" type="number" value={extra.limite_inv} onChange={v => setExtra({ ...extra, limite_inv: v })} placeholder="50000" />
                    <Input label="Limite contratos (€)" type="number" value={extra.limite_cont} onChange={v => setExtra({ ...extra, limite_cont: v })} placeholder="85000" />
                  </>
                )}
                {tipoDoc === 'bem_proprio' && (
                  <Select label="Sócio (deve ser casado em comunhão)" value={extra.socioId} onChange={v => setExtra({ ...extra, socioId: v })} options={(soc?.socios || []).filter(s => s.estado_civil === 'casado').map(s => ({ v: s.id, l: `Sócio ${s.letra} — ${s.nome || ''}` }))} />
                )}
                <Btn onClick={gerar} disabled={busy} style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>{busy ? 'A gerar...' : 'Gerar e descarregar DOCX'}</Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
