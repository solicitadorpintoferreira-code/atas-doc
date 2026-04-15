import { useEffect, useState } from 'react';
import { getAtlasTemplate, saveAtlasTemplate } from '../lib/db.js';
import { Btn, Alert } from '../components/ui.jsx';

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
  { id: 'dissolucao', label: 'Dissolução Voluntária', cat: 'Vida da Sociedade' },
  { id: 'transformacao', label: 'Transformação de Sociedade', cat: 'Vida da Sociedade' },
  { id: 'outro', label: 'Outra deliberação', cat: 'Outros' },
];

const DEFAULTS = {
  aumento_capital: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de aumento do capital social da sociedade.

Após análise da proposta, a assembleia deliberou aumentar o capital social da sociedade, atualmente no montante de {{capital}} ({{capital_por_extenso}} euros), para o montante de {{capital_novo}} ({{capital_novo_por_extenso}} euros), ou seja, em {{montante_aumento}} ({{montante_por_extenso}} euros), mediante {{forma_realizacao}}, nos seguintes termos:

a) Em consequência do aumento de capital, as quotas dos sócios passam a ter os seguintes valores nominais e percentagens de participação no capital social: [LISTA DE QUOTAS];

b) Fica o(s) gerente(s) expressamente autorizado(s) a praticar todos os atos necessários à execução da presente deliberação, incluindo a assinatura do texto atualizado do contrato de sociedade e a promoção do competente registo comercial.

Mais se deliberou que o contrato de sociedade passe a ter a seguinte redação no que respeita ao artigo relativo ao capital social: [NOVO TEXTO DO ARTIGO DO CAPITAL].

A presente deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Arts. 87.º, 88.º e 265.º CSC)`,

  reducao_capital: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de redução do capital social da sociedade.

Após análise, a assembleia deliberou reduzir o capital social da sociedade de {{capital_atual}} para {{capital_novo}}, ou seja, em {{montante_reducao}}, para {{motivo}} (cobertura de prejuízos / libertação de excesso de capital / reembolso de entradas), sem prejuízo do disposto no artigo 95.º do Código das Sociedades Comerciais.

A redução será efetuada através de redução proporcional do valor nominal das quotas de todos os sócios, passando as quotas a ter os seguintes valores: [LISTA DE NOVAS QUOTAS].

Em consequência, o artigo [N.º] do contrato de sociedade passa a ter a seguinte redação: [NOVO TEXTO].

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Arts. 94.º, 95.º e 265.º CSC)`,

  cessao_quotas: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de cessão de quota de sócio.

A assembleia deliberou consentir na cessão, pelo sócio {{cedente_nome}}, titular de uma quota com o valor nominal de {{cedente_quota}}, representativa de {{cedente_pct}}% do capital social, ao {{cessionario_nome}}, pelo preço de {{valor}}, nos termos do contrato de cessão de quotas celebrado nesta data, que fica arquivado na sociedade.

Os sócios presentes, titulares da totalidade do capital social, deram o seu expresso consentimento à cessão e declararam renunciar ao exercício do direito de preferência que lhes assistia nos termos do artigo 231.º do Código das Sociedades Comerciais.

Em consequência da cessão, o artigo [N.º] do contrato de sociedade relativo ao capital social passa a ter a seguinte redação: [NOVO TEXTO].

A deliberação foi aprovada por unanimidade. (Arts. 228.º, 231.º e 265.º CSC)`,

  alteracao_firma: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de alteração da firma da sociedade.

A assembleia deliberou alterar a firma da sociedade, que passa a ser "{{nova_firma}}", mantendo-se inalterados os restantes elementos do contrato de sociedade, com exceção do artigo relativo à firma, que passa a ter a seguinte redação:

"Artigo [N.º] (Firma)
1. A sociedade adota a firma «{{nova_firma}}»."

Foi apresentado o Certificado de Admissibilidade de firma n.º {{cert_codigo}}, emitido pelo Registo Nacional de Pessoas Coletivas, que confirma a disponibilidade da nova denominação.

Fica o(s) gerente(s) autorizado(s) a praticar todos os atos necessários à execução da presente deliberação, incluindo a promoção do competente registo comercial.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 265.º CSC)`,

  alteracao_sede: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de alteração da sede social da sociedade.

A assembleia deliberou alterar a sede social da sociedade, que atualmente se encontra em {{sede_atual}}, para {{sede_nova}}, freguesia de {{freguesia}}, concelho de {{concelho}}.

Em consequência, o artigo [N.º] do contrato de sociedade passa a ter a seguinte redação:

"Artigo [N.º] (Sede)
1. A sociedade tem a sua sede em {{sede_nova}}, freguesia de {{freguesia}}, concelho de {{concelho}}."

Fica o(s) gerente(s) autorizado(s) a praticar todos os atos necessários à execução da presente deliberação, incluindo a promoção do competente registo comercial.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 265.º CSC)`,

  alteracao_objeto: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de alteração do objeto social da sociedade.

A assembleia deliberou alterar o objeto social da sociedade, que passa a ser o seguinte:

"{{novo_objeto}}"

Em consequência, o artigo [N.º] do contrato de sociedade relativo ao objeto social passa a ter a redação acima transcrita.

Fica o(s) gerente(s) autorizado(s) a praticar todos os atos necessários à execução da presente deliberação, incluindo a promoção do competente registo comercial.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 265.º CSC)`,

  aprovacao_contas: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi apresentado à assembleia o relatório de gestão e as demonstrações financeiras do exercício de {{exercicio}}, bem como a proposta de aplicação de resultados.

A assembleia, após análise dos documentos apresentados, deliberou aprovar as contas do exercício de {{exercicio}}, verificando-se um resultado líquido de {{resultado}}.

Mais deliberou aprovar a seguinte aplicação do resultado: {{aplicacao_resultado}}.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 65.º CSC)`,

  distribuicao_lucros: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi apresentada à assembleia a proposta de distribuição de lucros do exercício de {{exercicio}}.

A assembleia deliberou distribuir lucros do referido exercício no montante total de {{montante}}, a distribuir {{forma_distribuicao}}.

A distribuição será efetuada no prazo máximo de 60 dias após a presente deliberação.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 217.º e ss. CSC)`,

  nomeacao_gerente: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de nomeação de gerente(s) da sociedade.

A assembleia deliberou nomear como gerente da sociedade o(a) sócio(a) {{socio_nome}}, com início de funções a partir de {{data_efeito}}, ficando investido nos poderes de gerência previstos na lei e no contrato de sociedade.

O gerente ora nomeado declarou aceitar o cargo, afirmando não estar inibido para o exercício de funções de administração ou direção de sociedades comerciais, nos termos da lei.

[Se alterar forma de obrigar:] Em consequência, o artigo [N.º] do contrato de sociedade passa a ter a seguinte redação: [NOVO TEXTO].

Fica o(s) gerente(s) autorizado(s) a promover o competente registo comercial da presente deliberação.

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Arts. 252.º e ss. CSC)`,

  destituicao_gerente: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de destituição do gerente da sociedade.

A assembleia deliberou aceitar a cessação de funções do(a) gerente {{socio_nome}}, com efeitos a partir de {{data_efeito}}, por {{fundamento}}.

[Se sem justa causa:] A sociedade fica sujeita ao pagamento das indemnizações devidas nos termos da lei, nomeadamente o disposto no artigo 257.º, n.º 7 do Código das Sociedades Comerciais.

[Se alteração da gerência:] Em consequência, o artigo [N.º] do contrato de sociedade passa a ter a seguinte redação: [NOVO TEXTO].

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social. (Art. 257.º CSC)`,

  dissolucao: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foi colocada à consideração da assembleia a proposta de dissolução da sociedade e subsequente entrada em liquidação.

Após discussão, a assembleia deliberou, nos termos do artigo 270.º do Código das Sociedades Comerciais, o seguinte:

1. Dissolver a sociedade, com efeitos a partir da presente data, por vontade dos sócios.

2. Em consequência da dissolução, a sociedade entra imediatamente em liquidação, passando a adotar a firma "{{firma}} — Sociedade em Liquidação", nos termos do artigo 146.º do Código das Sociedades Comerciais.

3. São nomeados como liquidatário(s) da sociedade: {{liquidatarios}}, que aceitam o cargo e ficam investidos de todos os poderes previstos no artigo 152.º do Código das Sociedades Comerciais.

4. Fica(m) o(s) liquidatário(s) incumbido(s) de promover o competente registo comercial da dissolução e da nomeação de liquidatários, bem como toda a publicidade legalmente exigida.

A deliberação foi aprovada por maioria de 3/4 dos votos correspondentes ao capital social. (Arts. 141.º, 146.º, 151.º, 152.º e 270.º CSC)`,

  transformacao: `Relativamente ao Ponto [NÚMERO] da ordem do dia, foram colocadas à consideração da assembleia as propostas relativas à transformação da sociedade.

Ponto [N.º]-A: A assembleia aprovou o balanço de transformação da sociedade reportado a [DATA], acompanhado do relatório da gerência que assegura que a situação patrimonial da sociedade não sofreu modificações significativas desde aquela data.

Ponto [N.º]-B: A assembleia deliberou transformar a sociedade {{tipo_atual}} em {{novo_tipo}}, mantendo a mesma personalidade jurídica, nos termos dos artigos 130.º e seguintes do Código das Sociedades Comerciais. O Certificado de Admissibilidade n.º {{cert_codigo}} confirma a admissibilidade da nova denominação.

Ponto [N.º]-C: A assembleia aprovou os {{estatutos/contrato}} da {{novo_tipo}} que passam a reger a sociedade, nos termos do projeto apresentado e anexo à presente ata.

Ficam os administradores/gerentes autorizados a promover o competente registo comercial e a praticar todos os demais atos necessários à execução. (Arts. 130.º a 140.º-A CSC)`,

  outro: `Relativamente ao Ponto [NÚMERO] da ordem do dia:

{{descricao_deliberacao}}

A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social.`,
};

const CAMPOS_DEFAULTS = {
  aumento_capital: [
    { tipo: 'select', label: 'Modalidade do aumento', key: 'forma_realizacao', options: 'novas entradas em dinheiro,incorporação de reservas,conversão de suprimentos,misto (suprimentos + dinheiro)' },
    { tipo: 'texto', label: 'Capital final pretendido (€)', key: 'capital_novo' },
    { tipo: 'texto', label: 'Prazo para realização das entradas', key: 'prazo_entradas' },
    { tipo: 'texto', label: 'IBAN da sociedade', key: 'iban' },
  ],
  cessao_quotas: [
    { tipo: 'checkbox', label: 'Gerar Contrato de Cessão de Quotas', key: 'gerar_contrato' },
    { tipo: 'checkbox', label: 'Gerar Acordo Parassocial', key: 'gerar_parassocial' },
    { tipo: 'checkbox', label: 'Gerar Declaração de Bem Próprio (sócio casado em comunhão)', key: 'gerar_bem_proprio' },
    { tipo: 'texto', label: 'Local da cessão', key: 'local' },
  ],
  alteracao_firma: [
    { tipo: 'select', label: 'Certificado de Admissibilidade obtido?', key: 'tem_cert', options: 'Sim,Não' },
    { tipo: 'texto', label: 'Código do Certificado de Admissibilidade', key: 'cert_codigo' },
  ],
  alteracao_sede: [
    { tipo: 'checkbox', label: 'Muda de Conservatória?', key: 'muda_conservatoria' },
  ],
  alteracao_objeto: [
    { tipo: 'checkbox', label: 'Atividade regulada (banca, seguros, mediação, etc.)?', key: 'atividade_regulada' },
  ],
  aprovacao_contas: [
    { tipo: 'select', label: 'Tipo de resultado', key: 'tipo_resultado', options: 'Lucro,Prejuízo,Resultado nulo' },
    { tipo: 'select', label: 'Aplicação de resultados', key: 'aplicacao', options: 'Distribuição de lucros,Retenção na empresa,Cobertura de prejuízos anteriores' },
    { tipo: 'checkbox', label: 'Houve intervenção de ROC?', key: 'houve_roc' },
  ],
  distribuicao_lucros: [
    { tipo: 'select', label: 'Forma de distribuição', key: 'forma_distribuicao', options: 'Proporcionalmente às quotas,Em partes iguais,Outro' },
    { tipo: 'texto', label: 'Prazo de pagamento (dias)', key: 'prazo_pagamento' },
  ],
  nomeacao_gerente: [
    { tipo: 'checkbox', label: 'Altera a cláusula da gerência no contrato?', key: 'altera_clausula' },
    { tipo: 'checkbox', label: 'Altera a forma de obrigar?', key: 'altera_forma_obrigar' },
  ],
  destituicao_gerente: [
    { tipo: 'select', label: 'Fundamento', key: 'fundamento', options: 'Mútuo acordo,Justa causa,Sem justa causa (com indemnização)' },
    { tipo: 'checkbox', label: 'Há contrato de trabalho associado?', key: 'tem_contrato_trabalho' },
  ],
  dissolucao: [
    { tipo: 'select', label: 'Fundamento da dissolução', key: 'fundamento', options: 'Por vontade dos sócios,Decurso do prazo,Realização do objeto,Outro' },
    { tipo: 'checkbox', label: 'Partilha imediata (sem dívidas)?', key: 'partilha_imediata' },
    { tipo: 'checkbox', label: 'Confirmar inexistência de dívidas fiscais?', key: 'sem_dividas_fiscais' },
  ],
  transformacao: [
    { tipo: 'select', label: 'Tipo atual → Novo tipo', key: 'nova_tipo', options: 'Lda. → SA,SA → Lda.,Outro' },
  ],
};

const PLACEHOLDERS = [
  { k: '{{data}}', d: 'Data da deliberação' },
  { k: '{{hora}}', d: 'Hora da deliberação' },
  { k: '{{numero_ata}}', d: 'Número da ata' },
  { k: '{{firma}}', d: 'Nome da sociedade' },
  { k: '{{nipc}}', d: 'NIPC' },
  { k: '{{sede}}', d: 'Sede social' },
  { k: '{{capital}}', d: 'Capital social' },
  { k: '{{forma_obrigar}}', d: 'Forma de obrigar' },
  { k: '{{objeto}}', d: 'Objeto social' },
  { k: '{{socios_presentes}}', d: 'Lista de sócios presentes' },
];

export default function Atlas() {
  const [selId, setSelId] = useState(TIPOS_DELIB[0].id);
  const [clausula, setClausula] = useState('');
  const [campos, setCampos] = useState([]);
  const [tab, setTab] = useState('clausula');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTemplate(selId); }, [selId]);

  const loadTemplate = async (id) => {
    setLoading(true);
    const t = await getAtlasTemplate(id);
    setClausula(t?.clausula_texto || DEFAULTS[id] || '');
    setCampos(t?.extra_campos || CAMPOS_DEFAULTS[id] || []);
    setLoading(false);
    setSaved(false);
  };

  const guardar = async () => {
    await saveAtlasTemplate(selId, { clausula_texto: clausula, extra_campos: campos });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const resetar = () => {
    setClausula(DEFAULTS[selId] || '');
    setCampos(CAMPOS_DEFAULTS[selId] || []);
  };

  const addCampo = () => setCampos(p => [...p, { tipo: 'texto', label: '', key: `campo_${Date.now()}` }]);
  const updCampo = (i, k, v) => setCampos(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const removeCampo = i => setCampos(p => p.filter((_, j) => j !== i));

  const cats = [...new Set(TIPOS_DELIB.map(t => t.cat))];
  const selTipo = TIPOS_DELIB.find(t => t.id === selId);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #E5E7EB', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="topbar-brand-tag">ATLAS</div>
          <div className="serif" style={{ fontSize: 18, marginTop: 2, fontWeight: 600 }}>Editor de deliberações</div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.4 }}>Edita cláusulas e campos. Alterações aplicam-se imediatamente.</p>
        </div>
        <div style={{ padding: '8px 0' }}>
          {cats.map(cat => (
            <div key={cat}>
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</div>
              {TIPOS_DELIB.filter(t => t.cat === cat).map(t => (
                <div key={t.id} onClick={() => setSelId(t.id)} style={{
                  padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                  background: selId === t.id ? '#FAF6EE' : 'transparent',
                  color: selId === t.id ? '#8B7355' : '#374151',
                  fontWeight: selId === t.id ? 600 : 400,
                  borderLeft: selId === t.id ? '3px solid #8B7355' : '3px solid transparent',
                }}>{t.label}</div>
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
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{selTipo?.cat}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saved && <span style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', padding: '4px 10px', borderRadius: 4 }}>✓ Guardado</span>}
              <Btn variant="secondary" size="sm" onClick={resetar}>Repor padrão</Btn>
              <Btn onClick={guardar} disabled={loading}>Guardar</Btn>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
            {[{ id: 'clausula', l: 'Cláusula da ata' }, { id: 'campos', l: 'Campos do formulário' }].map(t => (
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
                {'Este texto é inserido na ata como cláusula da deliberação. Usa {{variável}} para dados dinâmicos.'}
              </Alert>
              <textarea
                value={clausula}
                onChange={e => setClausula(e.target.value)}
                rows={16}
                style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 6, fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.7, marginTop: 12, resize: 'vertical' }}
              />
              <div style={{ marginTop: 12 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Placeholders disponíveis — clica para copiar</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PLACEHOLDERS.map(ph => (
                    <button key={ph.k} onClick={() => navigator.clipboard?.writeText(ph.k)} title={ph.d}
                      style={{ padding: '4px 10px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', color: '#374151' }}>
                      {ph.k}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 20, padding: 16, background: '#FAFAF8', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Pré-visualização</div>
                <div style={{ fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#374151' }}>
                  {clausula || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>O texto aparece aqui...</span>}
                </div>
              </div>
            </div>
          )}

          {tab === 'campos' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Campos específicos que aparecem no wizard para esta deliberação.
              </p>
              {campos.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#FAFAF8', borderRadius: 8, marginBottom: 12 }}>
                  Sem campos extra para este tipo.
                </div>
              )}
              {campos.map((campo, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 36px', gap: 8, marginBottom: 8, alignItems: 'center', padding: 12, background: '#FAFAF8', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                  <select value={campo.tipo} onChange={e => updCampo(i, 'tipo', e.target.value)} className="field-input" style={{ fontSize: 12, cursor: 'pointer' }}>
                    <option value="checkbox">Checkbox</option>
                    <option value="texto">Campo texto</option>
                    <option value="numero">Número</option>
                    <option value="select">Select</option>
                    <option value="data">Data</option>
                  </select>
                  <input value={campo.label} onChange={e => updCampo(i, 'label', e.target.value)} placeholder="Label do campo" className="field-input" style={{ fontSize: 13 }} />
                  {campo.tipo === 'select'
                    ? <input value={campo.options || ''} onChange={e => updCampo(i, 'options', e.target.value)} placeholder="opção1,opção2,opção3" className="field-input" style={{ fontSize: 12 }} />
                    : <input value={campo.key} onChange={e => updCampo(i, 'key', e.target.value)} placeholder="chave_interna" className="field-input" style={{ fontSize: 12, fontFamily: 'monospace' }} />
                  }
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
