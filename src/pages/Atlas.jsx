import { useEffect, useState } from 'react';
import { getAtlasTemplate, saveAtlasTemplate } from '../lib/db.js';
import { Btn, Textarea, Alert } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const TIPOS_DELIB = [
  { id: 'aumento_capital', label: 'Aumento de Capital', cat: 'Capital' },
  { id: 'reducao_capital', label: 'Redução de Capital', cat: 'Capital' },
  { id: 'cessao_quotas', label: 'Cessão de Quotas', cat: 'Quotas' },
  { id: 'alteracao_firma', label: 'Alteração de Firma', cat: 'Pacto Social' },
  { id: 'alteracao_sede', label: 'Alteração de Sede', cat: 'Pacto Social' },
  { id: 'alteracao_objeto', label: 'Alteração de Objeto Social', cat: 'Pacto Social' },
  { id: 'aprovacao_contas', label: 'Aprovação de Contas', cat: 'Contas' },
  { id: 'distribuicao_lucros', label: 'Distribuição de Lucros', cat: 'Contas' },
  { id: 'nomeacao_gerente', label: 'Nomeação de Gerente', cat: 'Gerência' },
  { id: 'destituicao_gerente', label: 'Destituição de Gerente', cat: 'Gerência' },
  { id: 'dissolucao', label: 'Dissolução', cat: 'Vida da Sociedade' },
  { id: 'transformacao', label: 'Transformação de Sociedade', cat: 'Vida da Sociedade' },
  { id: 'outro', label: 'Outra deliberação', cat: 'Outros' },
];

const DEFAULTS = {
  aumento_capital: 'Os sócios deliberaram, por unanimidade, aumentar o capital social da sociedade de {{capital_atual}} para {{capital_novo}}, correspondendo a um aumento de {{montante}}, mediante realização {{forma_realizacao}}.\n\nO capital aumentado ficará representado pelas quotas existentes, agora com novos valores nominais na proporção das participações de cada sócio.',
  reducao_capital: 'Os sócios deliberaram, por unanimidade, reduzir o capital social da sociedade de {{capital_atual}} para {{capital_novo}}, correspondendo a uma redução de {{montante}}.\n\nFundamento: {{fundamento}}.',
  cessao_quotas: 'O sócio Cedente deliberou, com o consentimento dos demais sócios, ceder a sua quota ao Cessionário, nos termos do contrato de cessão de quotas celebrado nesta data, pelo preço de {{valor}}.\n\nOs sócios presentes deram o seu expresso consentimento à cessão, nos termos do artigo 228.º do Código das Sociedades Comerciais.',
  alteracao_firma: 'Os sócios deliberaram, por unanimidade, alterar a firma da sociedade de "{{firma_atual}}" para "{{firma_nova}}", com certificado de admissibilidade n.º {{cert_codigo}}, aprovando simultaneamente a alteração do artigo correspondente do pacto social.',
  alteracao_sede: 'Os sócios deliberaram, por unanimidade, transferir a sede social da sociedade de "{{sede_atual}}" para "{{sede_nova}}", aprovando simultaneamente a alteração do artigo correspondente do pacto social.',
  alteracao_objeto: 'Os sócios deliberaram, por unanimidade, alterar o objeto social da sociedade, que passa a ser o seguinte:\n"{{objeto_novo}}"\nFicou aprovada a correspondente alteração ao pacto social.',
  aprovacao_contas: 'Os sócios deliberaram, por unanimidade, aprovar as contas do exercício de {{exercicio}}, verificando-se um resultado líquido de {{resultado}}.\n\nFoi deliberado o tratamento do resultado nos termos legais e estatutários.',
  distribuicao_lucros: 'Os sócios deliberaram, por unanimidade, distribuir lucros do exercício de {{exercicio}}, no montante total de {{montante}}, a distribuir {{forma_distribuicao}}.',
  nomeacao_gerente: 'Os sócios deliberaram, por unanimidade, nomear como gerente da sociedade o sócio {{socio_nome}}, cargo que exercerá a partir de {{data_efeito}}, com as competências previstas no pacto social e na lei.',
  destituicao_gerente: 'Os sócios deliberaram, por unanimidade, aceitar a cessação de funções do gerente {{socio_nome}}, com efeitos a partir de {{data_efeito}}, por {{fundamento}}, sem direito a qualquer indemnização.',
  dissolucao: 'Os sócios deliberaram, por unanimidade, a dissolução da sociedade, nos termos do artigo 141.º do Código das Sociedades Comerciais.\n\n{{detalhes}}\n\nFoi nomeado liquidatário responsável pelo processo de liquidação.',
  transformacao: 'Os sócios deliberaram, por unanimidade, a transformação da sociedade de {{tipo_atual}} em {{novo_tipo}}, com certificado de admissibilidade n.º {{cert_codigo}}, aprovando o novo pacto social que a este se junta.',
  outro: '{{detalhes}}',
};

const PLACEHOLDERS = [
  { k: '{{firma}}', d: 'Nome da sociedade' },
  { k: '{{nipc}}', d: 'NIPC' },
  { k: '{{sede}}', d: 'Sede social' },
  { k: '{{capital}}', d: 'Capital social' },
  { k: '{{data}}', d: 'Data da deliberação' },
  { k: '{{hora}}', d: 'Hora da deliberação' },
  { k: '{{numero_ata}}', d: 'Número da ata' },
  { k: '{{forma_obrigar}}', d: 'Forma de obrigar' },
];

export default function Atlas() {
  const [selId, setSelId] = useState(TIPOS_DELIB[0].id);
  const [template, setTemplate] = useState(null);
  const [clausula, setClausula] = useState('');
  const [extraCampos, setExtraCampos] = useState([]);
  const [tab, setTab] = useState('clausula');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profissional } = useAuth();

  useEffect(() => { load(selId); }, [selId]);

  const load = async (id) => {
    setLoading(true);
    const t = await getAtlasTemplate(id);
    if (t) {
      setClausula(t.clausula_texto || DEFAULTS[id] || '');
      setExtraCampos(t.extra_campos || []);
    } else {
      setClausula(DEFAULTS[id] || '');
      setExtraCampos([]);
    }
    setLoading(false);
    setSaved(false);
  };

  const guardar = async () => {
    await saveAtlasTemplate(selId, {
      clausula_texto: clausula,
      extra_campos: extraCampos,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addCampo = () => setExtraCampos(p => [...p, { tipo: 'checkbox', label: '', key: `campo_${Date.now()}` }]);
  const updCampo = (i, k, v) => setExtraCampos(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const removeCampo = (i) => setExtraCampos(p => p.filter((_, j) => j !== i));

  const catActual = [...new Set(TIPOS_DELIB.map(t => t.cat))];
  const selTipo = TIPOS_DELIB.find(t => t.id === selId);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 64px)', margin: '-32px -40px', overflow: 'hidden' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #E5E7EB', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="topbar-brand-tag">ATLAS</div>
          <div className="serif" style={{ fontSize: 18, marginTop: 2, fontWeight: 600 }}>Editor de deliberações</div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.4 }}>Edita os textos e campos de cada tipo de deliberação. As alterações aplicam-se imediatamente.</p>
        </div>
        <div style={{ padding: '8px 0' }}>
          {catActual.map(cat => (
            <div key={cat}>
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</div>
              {TIPOS_DELIB.filter(t => t.cat === cat).map(t => (
                <div key={t.id} onClick={() => setSelId(t.id)} style={{
                  padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                  background: selId === t.id ? '#FAF6EE' : 'transparent',
                  color: selId === t.id ? '#8B7355' : '#374151',
                  fontWeight: selId === t.id ? 600 : 400,
                  borderLeft: selId === t.id ? '3px solid #8B7355' : '3px solid transparent',
                }}>
                  {t.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 className="serif" style={{ fontSize: 24, fontWeight: 600 }}>{selTipo?.label}</h2>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Categoria: {selTipo?.cat}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saved && <span style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', padding: '4px 10px', borderRadius: 4 }}>✓ Guardado</span>}
              <Btn onClick={guardar} disabled={loading}>Guardar alterações</Btn>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
            {[{ id: 'clausula', l: 'Cláusula da ata' }, { id: 'campos', l: 'Campos extra do formulário' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 16px', background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #8B7355' : '2px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? '#1F2937' : '#6B7280',
              }}>{t.l}</button>
            ))}
          </div>

          {tab === 'clausula' && (
            <div>
              <Alert variant="info">
                {'Este texto é inserido na ata como cláusula da deliberação. Usa {{variável}} para dados dinâmicos. Os placeholders disponíveis estão listados abaixo.'}
              </Alert>
              <textarea
                value={clausula}
                onChange={e => setClausula(e.target.value)}
                rows={14}
                style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.7, marginTop: 12, resize: 'vertical' }}
                placeholder="Texto da cláusula..."
              />
              <div style={{ marginTop: 16 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Placeholders disponíveis (clica para copiar)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PLACEHOLDERS.map(ph => (
                    <button key={ph.k} onClick={() => { navigator.clipboard?.writeText(ph.k); }} title={ph.d}
                      style={{ padding: '4px 10px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', color: '#374151' }}>
                      {ph.k}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Clica num placeholder para copiar. Cola no texto acima onde precisas do valor dinâmico.</p>
              </div>

              <div style={{ marginTop: 20, padding: 16, background: '#FAFAF8', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Pré-visualização</div>
                <div style={{ fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#374151' }}>
                  {clausula || <span style={{ color: '#9CA3AF' }}>O texto aparece aqui...</span>}
                </div>
              </div>
            </div>
          )}

          {tab === 'campos' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Campos adicionais a mostrar no passo "Detalhes" do wizard para esta deliberação, além dos campos padrão.
              </p>
              {extraCampos.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#FAFAF8', borderRadius: 8, marginBottom: 12 }}>
                  Sem campos extra para este tipo de deliberação.
                </div>
              )}
              {extraCampos.map((campo, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 36px', gap: 8, marginBottom: 8, alignItems: 'center', padding: 12, background: '#FAFAF8', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                  <select value={campo.tipo} onChange={e => updCampo(i, 'tipo', e.target.value)} className="field-input" style={{ cursor: 'pointer', fontSize: 12 }}>
                    <option value="checkbox">Checkbox</option>
                    <option value="texto">Campo texto</option>
                    <option value="numero">Número</option>
                    <option value="data">Data</option>
                  </select>
                  <input value={campo.label} onChange={e => updCampo(i, 'label', e.target.value)} placeholder="Label do campo" className="field-input" style={{ fontSize: 13 }} />
                  <input value={campo.key} onChange={e => updCampo(i, 'key', e.target.value)} placeholder="Chave interna (ex: tipo_garantia)" className="field-input" style={{ fontSize: 12, fontFamily: 'monospace' }} />
                  <button onClick={() => removeCampo(i)} style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#B91C1C', fontSize: 16 }}>✕</button>
                </div>
              ))}
              <Btn variant="secondary" size="sm" onClick={addCampo} style={{ marginTop: 4 }}>+ Adicionar campo</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
