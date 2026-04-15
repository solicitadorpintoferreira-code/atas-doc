import { useEffect, useState } from 'react';
import { listSociedades, createSociedade, updateSociedade, deleteSociedade, getSociedadeByNipc } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';
import { Btn, Input, Select, Textarea, Modal, Badge, Empty, Alert, fmt } from '../components/ui.jsx';

const TIPOS = [
  { v: 'Sociedade por Quotas', l: 'Sociedade por Quotas' },
  { v: 'Sociedade Unipessoal por Quotas', l: 'Soc. Unipessoal por Quotas' },
  { v: 'Sociedade Anónima', l: 'Sociedade Anónima' },
];
const ESTADOS_CIVIS = [
  { v: 'solteiro', l: 'Solteiro(a)' },
  { v: 'casado', l: 'Casado(a)' },
  { v: 'divorciado', l: 'Divorciado(a)' },
  { v: 'viuvo', l: 'Viúvo(a)' },
];
const REGIMES = [
  { v: 'comunhao_adquiridos', l: 'Comunhão de adquiridos' },
  { v: 'comunhao_geral', l: 'Comunhão geral' },
  { v: 'separacao', l: 'Separação de bens' },
];
const DOC_TIPOS = [
  { v: 'CC', l: 'Cartão de Cidadão' },
  { v: 'TR', l: 'Título de Residência' },
  { v: 'AR', l: 'Autorização de Residência' },
  { v: 'PASSAPORTE', l: 'Passaporte' },
];

function getFormaObrigarOpts(numGerentes) {
  const n = Number(numGerentes) || 1;
  const opts = [{ v: 'isolada_qualquer', l: 'Qualquer gerente, isoladamente' }];
  if (n >= 2) {
    opts.push({ v: 'conjunta_dois', l: 'Quaisquer dois gerentes, em conjunto' });
    opts.push({ v: 'conjunta_todos', l: 'Todos os gerentes, em conjunto' });
  }
  if (n >= 3) opts.push({ v: 'maioria', l: 'Maioria dos gerentes, em conjunto' });
  return opts;
}

// Validações
function errNIF(nif) {
  if (!nif) return null;
  return /^\d{9}$/.test(nif) ? null : 'NIF deve ter exatamente 9 dígitos';
}
function errCC(num) {
  if (!num) return null;
  return /^\d{8} \d [A-Z]{2}\d$/.test(num) ? null : 'Formato: 12345678 0 ZY9';
}
function ccExpirado(validade) {
  if (!validade) return false;
  const [d, m, y] = validade.split('/').map(Number);
  if (!d || !m || !y) return false;
  return new Date(y, m - 1, d) < new Date();
}

export default function Sociedades({ socIdToOpen }) {
  const [socs, setSocs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busca, setBusca] = useState('');
  const { profissional } = useAuth();

  const reload = async () => setSocs(await listSociedades());
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (socIdToOpen && socs.length) {
      const s = socs.find(x => x.id === socIdToOpen);
      if (s) setEditing(s);
    }
  }, [socIdToOpen, socs]);

  const novo = () => setEditing({
    nipc: '', firma: '', tipo: 'Sociedade por Quotas', sede: '', capital: 0, objeto: '',
    num_gerentes: 1, forma_obrigar: 'isolada_qualquer',
    socios: [{ letra: 'A', quota: 0, pct: 100, tipo_pessoa: 'singular' }],
    _new: true,
  });

  const guardar = async (s) => {
    if (s._new) await createSociedade(s, profissional?.id);
    else await updateSociedade(s.id, s);
    setEditing(null);
    await reload();
  };

  const remover = async (id) => {
    if (!confirm('Eliminar esta sociedade e todos os dados associados?')) return;
    await deleteSociedade(id);
    await reload();
  };

  const filtered = socs.filter(s =>
    !busca || s.firma.toLowerCase().includes(busca.toLowerCase()) || s.nipc?.includes(busca)
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="topbar-brand-tag">CORPORATE P&A</div>
          <h1 className="serif" style={{ fontSize: 30, marginTop: 4 }}>Sociedades</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="search-input" placeholder="Procurar por firma ou NIPC..." value={busca} onChange={e => setBusca(e.target.value)} />
          <Btn onClick={novo}>+ Nova sociedade</Btn>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title="Sem sociedades. Adicione a primeira." action={<Btn onClick={novo}>+ Nova sociedade</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map(s => (
            <div key={s.id} className="card card-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="card-title">{s.firma}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>NIPC {s.nipc} · {s.tipo}</div>
                </div>
                <Badge variant="info">{s.socios?.length || 0} sócios</Badge>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', padding: '8px 0', borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6' }}>
                <div>Capital: <strong>{fmt(s.capital)}</strong></div>
                <div style={{ marginTop: 4 }}>{s.sede}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Btn variant="secondary" size="sm" onClick={() => setEditing(s)}>Editar</Btn>
                <Btn variant="danger" size="sm" onClick={() => remover(s.id)}>Eliminar</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EditModal sociedade={editing} onClose={() => setEditing(null)} onSave={guardar} />}
    </div>
  );
}

function EditModal({ sociedade, onClose, onSave }) {
  const [tab, setTab] = useState('dados');
  const [s, setS] = useState({ ...sociedade, socios: sociedade.socios || [] });
  const [erros, setErros] = useState({});

  const upd = (k, v) => setS(p => ({ ...p, [k]: v }));

  const updSoc = (i, k, v) =>
    setS(p => ({ ...p, socios: p.socios.map((x, j) => j === i ? { ...x, [k]: v } : x) }));

  const addSoc = () => setS(p => ({
    ...p,
    socios: [...p.socios, { letra: String.fromCharCode(65 + p.socios.length), quota: 0, pct: 0, tipo_pessoa: 'singular' }],
  }));

  const removeSoc = (i) => setS(p => ({ ...p, socios: p.socios.filter((_, j) => j !== i) }));

  const recalc = () => {
    const total = s.socios.reduce((a, x) => a + Number(x.quota || 0), 0);
    if (total === 0) return;
    setS(p => ({
      ...p,
      capital: total,
      socios: p.socios.map(x => ({ ...x, pct: Math.round((Number(x.quota || 0) / total) * 10000) / 100 })),
    }));
  };

  const validar = () => {
    const e = {};
    s.socios.forEach((soc, i) => {
      if (soc.tipo_pessoa !== 'coletiva') {
        const nifErr = errNIF(soc.nif);
        if (nifErr) e[`soc_${i}_nif`] = nifErr;
        if (soc.doc_tipo === 'CC') {
          const ccErr = errCC(soc.doc_num);
          if (ccErr) e[`soc_${i}_cc`] = ccErr;
          if (soc.doc_num && !ccErr && ccExpirado(soc.doc_validade)) {
            e[`soc_${i}_cc_exp`] = 'Documento expirado';
          }
        }
      }
    });
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    if (!validar()) {
      if (tab !== 'socios') setTab('socios');
      return;
    }
    await onSave({ ...s, capital: Number(s.capital) || 0 });
  };

  const formaOpts = getFormaObrigarOpts(s.num_gerentes);

  return (
    <Modal title={s._new ? 'Nova sociedade' : s.firma} size="lg" onClose={onClose} footer={
      <>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar}>Guardar</Btn>
      </>
    }>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
        {[{ id: 'dados', l: 'Dados públicos' }, { id: 'socios', l: 'Sócios' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid #8B7355' : '2px solid transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? '#1F2937' : '#6B7280',
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'dados' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="NIPC" value={s.nipc} onChange={v => upd('nipc', v)} required disabled={!s._new} />
          <Select label="Tipo" value={s.tipo} onChange={v => upd('tipo', v)} options={TIPOS} />
          <div style={{ gridColumn: '1/-1' }}><Input label="Firma" value={s.firma} onChange={v => upd('firma', v)} required /></div>
          <div style={{ gridColumn: '1/-1' }}><Input label="Sede" value={s.sede} onChange={v => upd('sede', v)} required /></div>
          <Input label="Capital social (€)" type="number" value={s.capital} onChange={v => upd('capital', v)} />
          <Input label="N.º gerentes" type="number" value={s.num_gerentes || 1} onChange={v => upd('num_gerentes', v)} />
          <div style={{ gridColumn: '1/-1' }}>
            <Select
              label="Forma de obrigar"
              value={s.forma_obrigar}
              onChange={v => upd('forma_obrigar', v)}
              options={formaOpts}
            />
          </div>
          <div style={{ gridColumn: '1/-1' }}><Textarea label="Objeto social" value={s.objeto} onChange={v => upd('objeto', v)} /></div>
          <div style={{ gridColumn: '1/-1' }}><Textarea label="Notas internas" value={s.notas} onChange={v => upd('notas', v)} /></div>
        </div>
      )}

      {tab === 'socios' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#6B7280' }}>Identificação completa de cada sócio ou sociedade.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn variant="secondary" size="sm" onClick={recalc}>↻ Recalcular %</Btn>
              <Btn variant="secondary" size="sm" onClick={addSoc}>+ Sócio</Btn>
            </div>
          </div>

          {s.socios.map((soc, i) => {
            const isColetiva = soc.tipo_pessoa === 'coletiva';
            return (
              <div key={i} style={{ background: '#FAFAF8', padding: 16, borderRadius: 8, marginBottom: 12, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 14 }}>Sócio {soc.letra}</strong>
                    <div style={{ display: 'flex', background: '#E5E7EB', borderRadius: 6, padding: 2 }}>
                      {[{ v: 'singular', l: 'Pessoa singular' }, { v: 'coletiva', l: 'Pessoa coletiva' }].map(opt => (
                        <button key={opt.v} onClick={() => updSoc(i, 'tipo_pessoa', opt.v)} style={{
                          padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
                          background: soc.tipo_pessoa === opt.v ? '#8B7355' : 'transparent',
                          color: soc.tipo_pessoa === opt.v ? '#fff' : '#6B7280', fontWeight: soc.tipo_pessoa === opt.v ? 600 : 400,
                        }}>{opt.l}</button>
                      ))}
                    </div>
                  </div>
                  <Btn variant="danger" size="sm" onClick={() => removeSoc(i)}>Remover</Btn>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <Input label="Quota (€)" type="number" value={soc.quota} onChange={v => updSoc(i, 'quota', v)} />
                  <Input label="%" type="number" value={soc.pct} onChange={v => updSoc(i, 'pct', v)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="field-label">Opções</label>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center', height: 36 }}>
                      <label><input type="checkbox" checked={!!soc.penhor} onChange={e => updSoc(i, 'penhor', e.target.checked)} /> Penhor</label>
                      <label><input type="checkbox" checked={!!soc.usufruto} onChange={e => updSoc(i, 'usufruto', e.target.checked)} /> Usufruto</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <label><input type="checkbox" checked={!!soc.quota_liberada} onChange={e => updSoc(i, 'quota_liberada', e.target.checked)} /> Quota totalmente liberada</label>
                  </div>

                  {isColetiva ? (
                    <>
                      <div style={{ gridColumn: '1/-1' }}><Input label="Firma" value={soc.firma_socio} onChange={v => updSoc(i, 'firma_socio', v)} /></div>
                      <Input label="NIPC" value={soc.nipc_socio} onChange={v => updSoc(i, 'nipc_socio', v)} />
                      <div style={{ gridColumn: 'span 2' }}><Input label="Sede" value={soc.sede_socio} onChange={v => updSoc(i, 'sede_socio', v)} /></div>
                      <Input label="Nome do representante" value={soc.representante_nome} onChange={v => updSoc(i, 'representante_nome', v)} />
                      <Input label="Cargo do representante" value={soc.representante_cargo} onChange={v => updSoc(i, 'representante_cargo', v)} />
                    </>
                  ) : (
                    <>
                      <div style={{ gridColumn: '1/-1' }}><Input label="Nome completo" value={soc.nome} onChange={v => updSoc(i, 'nome', v)} /></div>
                      <div>
                        <Input label="NIF" value={soc.nif} onChange={v => updSoc(i, 'nif', v)} />
                        {erros[`soc_${i}_nif`] && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>⚠ {erros[`soc_${i}_nif`]}</div>}
                      </div>
                      <Input label="Nacionalidade" value={soc.nacionalidade || 'Portuguesa'} onChange={v => updSoc(i, 'nacionalidade', v)} />
                      <Select label="Tipo doc." value={soc.doc_tipo} onChange={v => updSoc(i, 'doc_tipo', v)} options={DOC_TIPOS} />
                      <div style={{ gridColumn: 'span 2' }}>
                        <Input label="N.º documento" value={soc.doc_num} onChange={v => updSoc(i, 'doc_num', v)}
                          placeholder={soc.doc_tipo === 'CC' ? '12345678 0 ZY9' : ''} />
                        {soc.doc_tipo === 'CC' && erros[`soc_${i}_cc`] && (
                          <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>⚠ {erros[`soc_${i}_cc`]}</div>
                        )}
                        {soc.doc_tipo === 'CC' && erros[`soc_${i}_cc_exp`] && (
                          <div style={{ fontSize: 11, color: '#D97706', marginTop: 3 }}>⚠ {erros[`soc_${i}_cc_exp`]}</div>
                        )}
                      </div>
                      <div>
                        <Input label="Validade" value={soc.doc_validade} onChange={v => updSoc(i, 'doc_validade', v)} placeholder="DD/MM/AAAA" />
                        {soc.doc_validade && ccExpirado(soc.doc_validade) && (
                          <div style={{ fontSize: 11, color: '#D97706', marginTop: 3 }}>⚠ Documento expirado</div>
                        )}
                      </div>
                      <Select label="Estado civil" value={soc.estado_civil} onChange={v => updSoc(i, 'estado_civil', v)} options={ESTADOS_CIVIS} />
                      {soc.estado_civil === 'casado' && (
                        <Select label="Regime de bens" value={soc.regime_bens} onChange={v => updSoc(i, 'regime_bens', v)} options={REGIMES} />
                      )}
                      <Input label="Naturalidade (freguesia)" value={soc.natural_freguesia} onChange={v => updSoc(i, 'natural_freguesia', v)} />
                      <Input label="Concelho" value={soc.natural_concelho} onChange={v => updSoc(i, 'natural_concelho', v)} />
                      <div style={{ gridColumn: '1/-1' }}><Input label="Morada" value={soc.morada} onChange={v => updSoc(i, 'morada', v)} /></div>

                      {soc.estado_civil === 'casado' && (
                        <div style={{ gridColumn: '1/-1', background: '#FDF8F0', padding: 12, borderRadius: 6, border: '1px solid #E9D8AB' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#78582A', marginBottom: 8 }}>CÔNJUGE</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            <div style={{ gridColumn: 'span 2' }}><Input label="Nome" value={soc.conjuge_nome} onChange={v => updSoc(i, 'conjuge_nome', v)} /></div>
                            <Input label="NIF" value={soc.conjuge_nif} onChange={v => updSoc(i, 'conjuge_nif', v)} />
                            <Input label="N.º doc." value={soc.conjuge_doc_num} onChange={v => updSoc(i, 'conjuge_doc_num', v)} />
                            <Input label="Validade" value={soc.conjuge_doc_validade} onChange={v => updSoc(i, 'conjuge_doc_validade', v)} placeholder="DD/MM/AAAA" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
