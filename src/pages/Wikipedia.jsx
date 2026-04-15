import { useEffect, useState } from 'react';
import { listWikipediaEntries, saveWikipediaEntry } from '../lib/db.js';
import { Btn } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const SEED = [
  {
    slug: 'aumento_capital', titulo: 'Aumento de Capital', categoria: 'deliberacoes',
    resumo: 'O aumento do capital social permite reforçar os meios financeiros da sociedade e pode ser realizado por novas entradas em dinheiro, em espécie, por incorporação de reservas ou por conversão de suprimentos.',
    quando_usar: 'Quando os sócios decidem reforçar os recursos próprios da empresa, admitir novos sócios através de subscrição de novas quotas, ou consolidar a estrutura financeira. A deliberação de aumento de capital implica sempre alteração do contrato de sociedade.',
    documentos_necessarios: [
      'Contrato de sociedade atualizado',
      'Identificação completa dos sócios (CC/passaporte e NIF)',
      'IBAN da sociedade (para entradas em dinheiro)',
      'Contas aprovadas e balanço (para incorporação de reservas — art. 91.º CSC)',
      'Declaração do Contabilista Certificado ou ROC (para conversão de suprimentos — art. 89.º, n.º 4 CSC)',
      'Eventuais declarações de renúncia ao direito de preferência (art. 266.º CSC)',
    ],
    notas_legais: 'Arts. 87.º a 92.º e 266.º CSC. A deliberação deve mencionar: modalidade, montante, natureza das entradas, prazos e quem participa (art. 87.º, n.º 1 CSC). Exige maioria de 3/4 dos votos em Lda. (art. 265.º CSC). A deliberação caduca ao fim de 1 ano se não for emitida a declaração de entradas realizadas (art. 89.º, n.º 3 CSC). Prazo de registo: 2 meses.',
  },
  {
    slug: 'reducao_capital', titulo: 'Redução de Capital', categoria: 'deliberacoes',
    resumo: 'A redução do capital social pode servir para cobertura de prejuízos acumulados (mais comum em PME), libertação de excesso de capital ou reembolso de entradas aos sócios.',
    quando_usar: 'Principalmente quando a sociedade acumulou prejuízos que tornaram os capitais próprios inferiores ao capital social, para "limpar" o balanço. Também quando os sócios pretendem devolver capital em excesso.',
    documentos_necessarios: [
      'Contrato de sociedade atualizado',
      'Contas/balanço que demonstram os prejuízos ou o excesso de capital',
      'Identificação dos sócios',
    ],
    notas_legais: 'Arts. 94.º a 96.º CSC. Regra importante: a situação líquida após a redução tem de exceder o novo capital em pelo menos 20% (art. 95.º, n.º 1 CSC). A convocatória deve indicar expressamente a finalidade e a forma da redução (art. 94.º CSC). Em caso de reembolso, os credores têm um mês após publicação do registo para requerer garantias (art. 96.º CSC). Maioria: 3/4 dos votos em Lda. (art. 265.º CSC).',
  },
  {
    slug: 'cessao_quotas', titulo: 'Cessão de Quotas', categoria: 'deliberacoes',
    resumo: 'A cessão de quotas é a transmissão, total ou parcial, da participação de um sócio (cedente) a outro sócio ou a terceiro (cessionário), mediante contrato escrito e com as formalidades legais.',
    quando_usar: 'Quando um sócio pretende vender ou transferir a sua participação na sociedade. Pode ser total (toda a quota) ou parcial (fração da quota). Exige consentimento da sociedade, salvo nas exceções legais (arts. 228.º e 229.º CSC).',
    documentos_necessarios: [
      'CC/Passaporte e NIF de cedente e cessionário (identificação completa)',
      'Contrato de cessão de quotas assinado pelas partes',
      'Declarações de renúncia ao direito de preferência dos demais sócios (ou ata com essa renúncia)',
      'Certidão do Registo Comercial atualizada',
    ],
    notas_legais: 'Arts. 228.º a 233.º CSC. A cessão a terceiros não sócios exige consentimento da sociedade (art. 228.º, n.º 2 CSC). Os sócios têm direito de preferência (art. 231.º CSC) — prazo de 30 dias após notificação. A cessão só produz efeitos perante a sociedade após comunicação ou reconhecimento (art. 228.º, n.º 3 CSC). Atenção: possíveis implicações de Imposto do Selo e IRS/IRC sobre mais-valias.',
  },
  {
    slug: 'alteracao_firma', titulo: 'Alteração de Firma', categoria: 'deliberacoes',
    resumo: 'Alteração da denominação social da empresa, que implica modificação do contrato de sociedade e registo comercial. Requer obrigatoriamente Certificado de Admissibilidade de firma emitido pelo RNPC.',
    quando_usar: 'Reposicionamento de marca, mudança de atividade principal, ou quando o nome atual não reflete adequadamente a identidade da empresa. A nova firma tem de cumprir as regras de composição previstas no CSC.',
    documentos_necessarios: [
      'Certificado de Admissibilidade de firma (obtido junto do RNPC)',
      'Identificação dos sócios',
      'Contrato de sociedade atualizado',
    ],
    notas_legais: 'É obrigatório obter previamente o Certificado de Admissibilidade junto do Registo Nacional de Pessoas Coletivas, que confirma que a nova denominação está disponível e é legalmente admissível. Alteração do contrato exige maioria de 3/4 dos votos em Lda. (art. 265.º CSC). Prazo de registo: 2 meses.',
  },
  {
    slug: 'alteracao_sede', titulo: 'Alteração de Sede', categoria: 'deliberacoes',
    resumo: 'Transferência da sede social para novo endereço, com necessidade de alteração do contrato de sociedade e registo comercial.',
    quando_usar: 'Mudança de instalações, otimização fiscal (transferência entre municípios) ou reorganização operacional. Atenção: alguns contratos permitem que a gerência altere a sede dentro do mesmo concelho sem necessidade de assembleia.',
    documentos_necessarios: [
      'Prova de domicílio na nova morada (contrato de arrendamento, certidão de propriedade ou declaração)',
      'Contrato de sociedade atualizado',
      'Identificação dos sócios',
    ],
    notas_legais: 'Alteração do contrato exige maioria de 3/4 dos votos em Lda. (art. 265.º CSC). Verificar se o contrato de sociedade contém cláusula que permita à gerência mudar a sede dentro do mesmo concelho — nesse caso, pode ser feito por deliberação da gerência, sem assembleia.',
  },
  {
    slug: 'alteracao_objeto', titulo: 'Alteração de Objeto Social', categoria: 'deliberacoes',
    resumo: 'Modificação da atividade ou atividades que a sociedade se propõe exercer, conforme definido no pacto social. Implica alteração do contrato e, por vezes, atualização do CAE.',
    quando_usar: 'Quando a empresa inicia, abandona ou muda significativamente a sua atividade. Em atividades reguladas (banca, seguros, mediação imobiliária, turismo, saúde), pode exigir licenças ou autorizações prévias.',
    documentos_necessarios: [
      'Texto do novo objeto social',
      'Contrato de sociedade atualizado',
      'Eventuais licenças/autorizações para atividades reguladas',
    ],
    notas_legais: 'Alteração do contrato exige maioria de 3/4 dos votos em Lda. (art. 265.º CSC). O novo objeto deve ser lícito, possível e determinado. Verificar impacto no CAE e eventuais obrigações de comunicação a autoridades reguladoras.',
  },
  {
    slug: 'aprovacao_contas', titulo: 'Aprovação de Contas', categoria: 'deliberacoes',
    resumo: 'Apreciação e aprovação anual do relatório de gestão e das demonstrações financeiras do exercício económico anterior. Obrigação legal de todas as sociedades comerciais (art. 65.º CSC).',
    quando_usar: 'Obrigatoriamente uma vez por ano. O prazo é até 31 de março para o exercício anterior. O depósito das contas na IES tem prazo até 15 de julho do ano seguinte ao exercício.',
    documentos_necessarios: [
      'Relatório de gestão',
      'Balanço e demonstração de resultados',
      'Relatório do Fiscal Único (se aplicável)',
      'Relatório do ROC (se obrigatório)',
    ],
    notas_legais: 'Art. 65.º CSC. A omissão continuada de depósito de contas pode gerar dissolução administrativa (art. 150.º do Decreto-Lei n.º 76-A/2006). O depósito da IES tem coima por incumprimento. Maioria simples para aprovação, salvo disposição contratual diferente.',
  },
  {
    slug: 'distribuicao_lucros', titulo: 'Distribuição de Lucros', categoria: 'deliberacoes',
    resumo: 'Deliberação sobre a aplicação dos lucros do exercício aos sócios. Pressupõe aprovação prévia das contas e existência de lucros distribuíveis, respeitando a reserva legal obrigatória.',
    quando_usar: 'Após aprovação das contas do exercício, quando existam lucros distribuíveis e se pretenda remunerar os sócios.',
    documentos_necessarios: [
      'Contas aprovadas do exercício',
      'Cálculo da reserva legal obrigatória',
    ],
    notas_legais: 'Arts. 217.º a 219.º CSC. É obrigatório constituir ou reforçar a reserva legal com pelo menos 5% dos lucros anuais, até atingir 20% do capital social. Só podem ser distribuídos lucros que não sejam necessários para cobrir prejuízos transitados. Atenção às obrigações de retenção na fonte de IRS/IRC.',
  },
  {
    slug: 'nomeacao_gerente', titulo: 'Nomeação de Gerente', categoria: 'deliberacoes',
    resumo: 'Designação de um ou mais gerentes para representar e obrigar a sociedade. Pode implicar alteração do artigo do contrato relativo à gerência.',
    quando_usar: 'Na constituição da sociedade, quando um gerente cessa funções, para reforço da gerência, ou quando se pretende alterar a composição do órgão de administração.',
    documentos_necessarios: [
      'Identificação do novo gerente (CC/Passaporte e NIF)',
      'Declaração de aceitação do cargo',
      'Declaração de não inibição para o exercício de funções de gestão',
    ],
    notas_legais: 'Arts. 252.º a 261.º CSC. O gerente é responsável perante a sociedade pelos danos causados por atos ou omissões com violação dos deveres legais ou contratuais. O registo da nomeação é obrigatório — prazo de 2 meses. A nomeação com alteração da cláusula da gerência exige maioria de 3/4 em Lda. (art. 265.º CSC).',
  },
  {
    slug: 'destituicao_gerente', titulo: 'Destituição de Gerente', categoria: 'deliberacoes',
    resumo: 'Cessação do mandato de gerente por deliberação dos sócios, com ou sem justa causa. A destituição sem justa causa pode implicar pagamento de indemnização.',
    quando_usar: 'Quando os sócios decidem substituir ou prescindir de um gerente, seja por motivos de desempenho, reestruturação da gerência ou existência de justa causa.',
    documentos_necessarios: [
      'Documentação de suporte ao fundamento (se justa causa)',
      'Identificação dos sócios',
    ],
    notas_legais: 'Art. 257.º CSC. A destituição sem justa causa obriga ao pagamento de indemnização pelo dano causado (art. 257.º, n.º 7 CSC). A destituição com justa causa não confere direito a indemnização. O gerente destituído sem justa causa tem direito a indemnização pelo período em falta do mandato. Verificar se há contrato de trabalho associado ao cargo.',
  },
  {
    slug: 'dissolucao', titulo: 'Dissolução e Liquidação', categoria: 'deliberacoes',
    resumo: 'Processo de extinção voluntária da sociedade, que passa pela deliberação de dissolução, entrada em liquidação, pagamento de dívidas, partilha do ativo restante e extinção pelo registo comercial.',
    quando_usar: 'Quando os sócios decidem encerrar definitivamente a atividade da empresa.',
    documentos_necessarios: [
      'Identificação dos sócios e liquidatários',
      'Declaração de não existência de dívidas fiscais (recomendado)',
      'Contas à data da dissolução (a organizar no prazo de 60 dias — art. 149.º CSC)',
      'Relatório de liquidação e proposta de partilha',
    ],
    notas_legais: 'Arts. 141.º a 160.º e 270.º CSC. Maioria de 3/4 dos votos para a dissolução voluntária (art. 270.º CSC). A partir da dissolução, a firma passa a incluir "em liquidação" (art. 146.º CSC). Prazo legal para encerrar a liquidação: 2 anos, prorrogável por 1 ano (art. 150.º CSC). Após registo do encerramento, a sociedade considera-se extinta (art. 160.º CSC).',
  },
  {
    slug: 'contrato_cessao', titulo: 'Contrato de Cessão de Quotas', categoria: 'contratos',
    resumo: 'Documento que formaliza a transmissão de uma quota entre o sócio cedente e o cessionário. Deve identificar as partes, a quota cedida, o preço, as condições de pagamento e as declarações de garantia do cedente.',
    quando_usar: 'Obrigatório sempre que haja transmissão de quotas por ato entre vivos. A lei exige forma escrita (art. 228.º, n.º 1 CSC), mas não exige escritura pública nem documento autenticado — basta documento particular, preferencialmente com assinaturas reconhecidas.',
    documentos_necessarios: [
      'Identificação completa de cedente e cessionário',
      'Declarações de renúncia a preferência (ou ata que as documente)',
      'Consentimento da sociedade (se exigido pelo contrato)',
    ],
    notas_legais: 'A cessão só produz efeitos perante a sociedade após comunicação ou reconhecimento por esta (art. 228.º, n.º 3 CSC). O registo definitivo exige que decorra o prazo de preferência dos sócios. Atenção a eventuais implicações de Imposto do Selo sobre a transmissão.',
  },
  {
    slug: 'acordo_parassocial', titulo: 'Acordo Parassocial', categoria: 'contratos',
    resumo: 'Contrato privado entre sócios que regula aspetos das suas relações recíprocas não cobertos ou complementares ao pacto social, como direitos de preferência, tag-along, drag-along, não concorrência e governação.',
    quando_usar: 'Recomendado quando existem múltiplos sócios com participações significativas e se pretende regular com maior detalhe as relações entre eles, especialmente em sociedades com sócios fundadores e investidores, ou quando há risco de bloqueios.',
    documentos_necessarios: [
      'Identificação de todas as partes',
      'Pacto social atualizado (para referência e coerência)',
    ],
    notas_legais: 'Art. 17.º CSC. Os acordos parassociais vinculam apenas as partes — não são oponíveis à sociedade nem a terceiros de boa-fé. Com base neles não podem ser impugnados atos da sociedade (art. 17.º, n.º 1 CSC). A violação gera responsabilidade civil mas não afeta a validade dos atos societários praticados em sentido contrário. São nulos os acordos que obriguem a votar sempre conforme instruções ou em troca de vantagens (art. 17.º, n.º 3 CSC).',
  },
  {
    slug: 'declaracao_bem_proprio', titulo: 'Declaração de Bem Próprio', categoria: 'contratos',
    resumo: 'Declaração conjunta do sócio e do seu cônjuge a afirmar que o valor investido na sociedade provém de bens próprios do sócio (herança, doação, sub-rogação real), excluindo a quota do patrimônio comum do casal.',
    quando_usar: 'Necessária quando um sócio casado em regime de comunhão (de adquiridos ou geral) adquire ou detém uma quota com capital que seja bem próprio. Não é necessária se a quota foi adquirida com bens comuns.',
    documentos_necessarios: [
      'Identificação de ambos os cônjuges (CC e NIF)',
      'Prova da natureza própria dos fundos (habilitação de herdeiros, escritura de doação, etc.)',
    ],
    notas_legais: 'Art. 1722.º al. c) do Código Civil. A declaração deve ser expressa no próprio ato ou em documento autêntico ou autenticado anterior ou coevo da aquisição. Sem esta declaração, a quota adquirida com dinheiro próprio pode ser considerada bem comum. A declaração não cria a natureza própria — apenas a documenta. É prudente recolher também a assinatura do cônjuge, para evitar litígios futuros em caso de divórcio ou partilha.',
  },
  {
    slug: 'sociedades_quotas', titulo: 'Sociedade por Quotas (Lda.)', categoria: 'geral',
    resumo: 'A sociedade por quotas é o tipo societário mais comum em Portugal. O capital social está dividido em quotas e a responsabilidade dos sócios limita-se ao valor do capital subscrito (art. 197.º CSC).',
    quando_usar: 'Forma mais adequada para empresas de pequena e média dimensão, com número reduzido de sócios (1 a 30, tipicamente), que pretendem limitar a responsabilidade pessoal e ter uma estrutura de governação simples.',
    documentos_necessarios: [
      'Pacto social / contrato de sociedade',
      'Identificação dos sócios fundadores',
      'Capital social mínimo: 1€ (mas capital simbólico implica responsabilidade solidária por 5 anos)',
    ],
    notas_legais: 'Arts. 197.º a 270.º CSC. Capital mínimo: 1€ (recomendado: mínimo 5.000€). N.º mínimo de sócios: 1 (Sociedade Unipessoal) ou 2. Gerência obrigatória por sócio(s) ou terceiro(s). Maioria de 3/4 dos votos para alterar o contrato (art. 265.º CSC). Assembleia de sócios é o órgão supremo de decisão.',
  },
  {
    slug: 'sociedades_anonimas', titulo: 'Sociedade Anónima (S.A.)', categoria: 'geral',
    resumo: 'A sociedade anónima é indicada para empresas de maior dimensão. O capital social divide-se em ações livremente transmissíveis, com responsabilidade limitada dos acionistas. Obrigatória a intervenção de ROC.',
    quando_usar: 'Empresas com necessidade de muitos acionistas, acesso a mercados de capitais, ou que pretendam estrutura de governance mais robusta. Capital mínimo: 50.000€.',
    documentos_necessarios: [
      'Escritura pública de constituição',
      'Capital social mínimo: 50.000€, com realização mínima de 30% no ato constitutivo',
      'Estatutos aprovados',
      'Nomeação de ROC obrigatória',
    ],
    notas_legais: 'Arts. 271.º a 464.º CSC. Capital mínimo: 50.000€. N.º mínimo de acionistas: 1 (SA unipessoal). Obrigatoriedade de Revisor Oficial de Contas (ROC). Quórum de 1/3 do capital para deliberar sobre alterações aos estatutos (art. 383.º, n.º 2 CSC). Maioria de 2/3 dos votos emitidos para alterações estatutárias (art. 386.º, n.º 3 CSC).',
  },
];

const CATS = { deliberacoes: 'Deliberações', contratos: 'Contratos', geral: 'Geral' };

export default function Wikipedia() {
  const [entries, setEntries] = useState([]);
  const [selSlug, setSelSlug] = useState(SEED[0].slug);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { profissional } = useAuth();

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const data = await listWikipediaEntries();
    if (data.length === 0) {
      setSeeding(true);
      for (const entry of SEED) await saveWikipediaEntry(entry.slug, entry);
      const fresh = await listWikipediaEntries();
      setEntries(fresh);
      setSeeding(false);
    } else {
      setEntries(data);
    }
  };

  const selEntry = entries.find(e => e.slug === selSlug) || SEED.find(e => e.slug === selSlug);

  const startEdit = () => { setDraft({ ...selEntry }); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };

  const guardar = async () => {
    await saveWikipediaEntry(selSlug, draft);
    const data = await listWikipediaEntries();
    setEntries(data);
    setEditing(false);
    setDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const updDraft = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  const updDoc = (i, v) => setDraft(p => ({ ...p, documentos_necessarios: (p.documentos_necessarios || []).map((x, j) => j === i ? v : x) }));
  const addDoc = () => setDraft(p => ({ ...p, documentos_necessarios: [...(p.documentos_necessarios || []), ''] }));
  const removeDoc = i => setDraft(p => ({ ...p, documentos_necessarios: (p.documentos_necessarios || []).filter((_, j) => j !== i) }));

  if (seeding) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 24 }}>📚</div>
      <div style={{ fontSize: 14, color: '#6B7280' }}>A preparar base de conhecimento...</div>
    </div>
  );

  const displayEntry = editing ? draft : selEntry;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #E5E7EB', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="topbar-brand-tag">WIKIPÉDIA JURÍDICA</div>
          <div className="serif" style={{ fontSize: 18, marginTop: 2, fontWeight: 600 }}>Base de conhecimento</div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.4 }}>Referência interna para deliberações, contratos e direito societário.</p>
        </div>
        <div style={{ padding: '8px 0' }}>
          {Object.entries(CATS).map(([cid, cl]) => {
            const catEntries = entries.length > 0 ? entries.filter(e => e.categoria === cid) : SEED.filter(e => e.categoria === cid);
            if (!catEntries.length) return null;
            return (
              <div key={cid}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cl}</div>
                {catEntries.map(e => (
                  <div key={e.slug} onClick={() => { setSelSlug(e.slug); setEditing(false); setDraft(null); }} style={{
                    padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                    background: selSlug === e.slug ? '#FAF6EE' : 'transparent',
                    color: selSlug === e.slug ? '#8B7355' : '#374151',
                    fontWeight: selSlug === e.slug ? 600 : 400,
                    borderLeft: selSlug === e.slug ? '3px solid #8B7355' : '3px solid transparent',
                  }}>{e.titulo}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel direito */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
        {!displayEntry ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Seleciona um artigo à esquerda.</div>
        ) : editing ? (
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 600 }}>Editar: {displayEntry.titulo}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={cancelEdit}>Cancelar</Btn>
                <Btn onClick={guardar}>Guardar</Btn>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Resumo</label>
                <textarea value={draft.resumo || ''} onChange={e => updDraft('resumo', e.target.value)} rows={3} className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
              </div>
              <div>
                <label className="field-label">Quando usar</label>
                <textarea value={draft.quando_usar || ''} onChange={e => updDraft('quando_usar', e.target.value)} rows={3} className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="field-label">Documentos necessários</label>
                  <button onClick={addDoc} style={{ fontSize: 12, color: '#8B7355', background: 'none', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
                </div>
                {(draft.documentos_necessarios || []).map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={d} onChange={e => updDoc(i, e.target.value)} className="field-input" style={{ flex: 1 }} />
                    <button onClick={() => removeDoc(i)} style={{ padding: '4px 8px', border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 4, cursor: 'pointer', color: '#B91C1C' }}>✕</button>
                  </div>
                ))}
              </div>
              <div>
                <label className="field-label">Notas legais</label>
                <textarea value={draft.notas_legais || ''} onChange={e => updDraft('notas_legais', e.target.value)} rows={5} className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#B8976A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {CATS[displayEntry.categoria] || displayEntry.categoria}
                </div>
                <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, color: '#1F2937' }}>{displayEntry.titulo}</h1>
              </div>
              {profissional?.is_admin && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {saved && <span style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', padding: '4px 10px', borderRadius: 4 }}>✓ Guardado</span>}
                  <Btn variant="secondary" size="sm" onClick={startEdit}>✏ Editar</Btn>
                </div>
              )}
            </div>

            {displayEntry.resumo && (
              <div style={{ marginBottom: 28, padding: 20, background: '#FAF6EE', borderRadius: 8, borderLeft: '4px solid #B8976A' }}>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>{displayEntry.resumo}</p>
              </div>
            )}

            {displayEntry.quando_usar && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quando usar</h3>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>{displayEntry.quando_usar}</p>
              </div>
            )}

            {displayEntry.documentos_necessarios?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Documentos necessários</h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
                  {displayEntry.documentos_necessarios.map((d, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14, color: '#374151' }}>
                      <span style={{ color: '#B8976A', fontWeight: 600, flexShrink: 0 }}>→</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {displayEntry.notas_legais && (
              <div style={{ marginBottom: 28, padding: 20, background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notas legais e artigos do CSC</h3>
                <p style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.8 }}>{displayEntry.notas_legais}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
