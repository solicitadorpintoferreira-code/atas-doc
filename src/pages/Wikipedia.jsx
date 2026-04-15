import { useEffect, useState } from 'react';
import { listWikipediaEntries, saveWikipediaEntry } from '../lib/db.js';
import { Btn, Alert } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const SEED = [
  // Deliberações
  {
    slug: 'aumento_capital', titulo: 'Aumento de Capital', categoria: 'deliberacoes',
    resumo: 'O aumento do capital social permite reforçar os meios financeiros da sociedade. Pode ser realizado por entradas em dinheiro, em espécie ou por incorporação de reservas.',
    quando_usar: 'Quando os sócios decidem reforçar os recursos próprios da empresa, admitir novos sócios através de subscrição de novas quotas, ou consolidar a estrutura financeira para acesso a financiamento bancário.',
    documentos_necessarios: ['Identificação dos sócios (CC ou Passaporte)', 'Certificação de depósito bancário (se realização em dinheiro)', 'Avaliação de bens (se realização em espécie)', 'Certidão do Registo Comercial atualizada'],
    notas_legais: 'Arts. 87.º a 97.º CSC. O aumento deve ser registado no Registo Comercial no prazo de 2 meses a contar da deliberação (art. 92.º CSC). A deliberação deve ser tomada por maioria qualificada de 3/4 dos votos, salvo disposição contrária do pacto social.',
  },
  {
    slug: 'cessao_quotas', titulo: 'Cessão de Quotas', categoria: 'deliberacoes',
    resumo: 'A cessão de quotas consiste na transmissão, total ou parcial, da participação de um sócio a outro sócio ou a terceiro, mediante contrato escrito.',
    quando_usar: 'Quando um sócio pretende vender ou transferir a sua participação na sociedade, na sequência de acordo entre as partes. Pode ser total (toda a quota) ou parcial (fracção da quota).',
    documentos_necessarios: ['CC/Passaporte de cedente e cessionário', 'Declaração de consentimento dos restantes sócios', 'Contrato de cessão de quotas', 'Certidão do Registo Comercial', 'Certidão de inexistência de dívidas fiscais (se exigida)'],
    notas_legais: 'Arts. 228.º a 233.º CSC. A cessão a terceiros está sujeita ao consentimento da sociedade e ao direito de preferência dos restantes sócios (art. 231.º CSC). O prazo de preferência é de 30 dias a contar da notificação. A cessão deve ser levada ao Registo Comercial.',
  },
  {
    slug: 'alteracao_firma', titulo: 'Alteração de Firma', categoria: 'deliberacoes',
    resumo: 'Alteração da denominação social da empresa, que implica modificação do pacto social e registo comercial.',
    quando_usar: 'Reposicionamento de marca, fusão com outra empresa, mudança de atividade principal, ou quando o nome atual já não reflete a realidade da empresa.',
    documentos_necessarios: ['Certificado de Admissibilidade de firma (RNPC)', 'Identificação dos sócios', 'Certidão do Registo Comercial'],
    notas_legais: 'Requer Certificado de Admissibilidade emitido pelo Registo Nacional de Pessoas Coletivas (RNPC), que confirma que a nova firma está disponível. O registo da alteração deve ser feito no prazo de 2 meses.',
  },
  {
    slug: 'alteracao_sede', titulo: 'Alteração de Sede', categoria: 'deliberacoes',
    resumo: 'Transferência da sede social para novo endereço, com ou sem alteração de conservatória de registo.',
    quando_usar: 'Mudança de instalações, otimização fiscal (transferência entre municípios), ou reorganização operacional.',
    documentos_necessarios: ['Prova de domicílio na nova morada (contrato de arrendamento ou escritura)', 'Identificação dos sócios', 'Certidão do Registo Comercial'],
    notas_legais: 'Se a nova sede se situa na área de outra Conservatória do Registo Comercial, é necessário proceder ao registo na nova Conservatória e remeter certidão do registo anterior. Prazo de registo: 2 meses.',
  },
  {
    slug: 'aprovacao_contas', titulo: 'Aprovação de Contas', categoria: 'deliberacoes',
    resumo: 'Aprovação anual das demonstrações financeiras do exercício económico anterior, obrigação legal de todas as sociedades comerciais.',
    quando_usar: 'Obrigatoriamente até 31 de março de cada ano para o exercício anterior, para depósito posterior das contas na Conservatória (IES) até 15 de julho.',
    documentos_necessarios: ['Balanço e demonstração de resultados', 'Relatório de gestão', 'Parecer do fiscal único (se aplicável)', 'Relatório do ROC (se obrigatório)'],
    notas_legais: 'Art. 65.º CSC. A aprovação das contas é obrigação anual. A omissão pode gerar dissolução administrativa (art. 150.º CSC). O depósito das contas (IES) tem prazo até 15 de julho, com coima por incumprimento.',
  },
  {
    slug: 'distribuicao_lucros', titulo: 'Distribuição de Lucros', categoria: 'deliberacoes',
    resumo: 'Deliberação sobre a aplicação dos lucros do exercício, incluindo a distribuição total ou parcial aos sócios.',
    quando_usar: 'Após aprovação das contas do exercício, quando existam lucros distribuíveis, respeitando a reserva legal obrigatória e as necessidades de capitalização da empresa.',
    documentos_necessarios: ['Contas aprovadas do exercício', 'Parecer do órgão de fiscalização (se existente)'],
    notas_legais: 'Arts. 217.º a 219.º CSC. É obrigatório constituir ou reforçar a reserva legal com pelo menos 5% dos lucros anuais, até atingir 20% do capital social. Só podem ser distribuídos lucros que não sejam necessários para cobrir prejuízos transitados.',
  },
  {
    slug: 'nomeacao_gerente', titulo: 'Nomeação de Gerente', categoria: 'deliberacoes',
    resumo: 'Designação de um ou mais gerentes para representar e obrigar a sociedade.',
    quando_usar: 'Na constituição da sociedade, quando um gerente cessa funções, para reforço da gerência, ou quando se pretende alterar a composição do órgão de administração.',
    documentos_necessarios: ['Identificação do novo gerente (CC/Passaporte)', 'Declaração de aceitação do cargo', 'Declaração de não inibição para o exercício do comércio'],
    notas_legais: 'Arts. 252.º a 261.º CSC. O gerente responde perante a sociedade pelos danos causados por atos ou omissões com violação dos deveres legais ou contratuais. O registo da nomeação é obrigatório e deve ser efetuado em 2 meses.',
  },
  {
    slug: 'destituicao_gerente', titulo: 'Destituição de Gerente', categoria: 'deliberacoes',
    resumo: 'Cessação do mandato de gerente, com ou sem justa causa, por deliberação dos sócios.',
    quando_usar: 'Quando os sócios decidem substituir ou prescindir de um gerente, quer por motivos de desempenho, reestruturação da gerência ou existência de justa causa.',
    documentos_necessarios: ['Documentação de suporte ao fundamento da destituição (se justa causa)', 'Identificação dos sócios'],
    notas_legais: 'Art. 257.º CSC. A destituição sem justa causa obriga ao pagamento de indemnização pelo dano causado. A destituição com justa causa não confere direito a indemnização. O gerente destituído sem justa causa tem direito a indemnização equivalente à remuneração correspondente ao período do mandato em falta.',
  },
  {
    slug: 'dissolucao', titulo: 'Dissolução', categoria: 'deliberacoes',
    resumo: 'Deliberação de extinção voluntária da sociedade, dando início ao processo de liquidação do patrimônio social.',
    quando_usar: 'Quando os sócios decidem encerrar a atividade da empresa, após conclusão do objeto social, ou por incapacidade de prosseguir a atividade.',
    documentos_necessarios: ['Identificação dos sócios', 'Declaração de não existência de trabalhadores (se aplicável)', 'Certidão de inexistência de dívidas fiscais e à Segurança Social'],
    notas_legais: 'Arts. 141.º a 160.º CSC. A dissolução voluntária deve ser deliberada por 3/4 dos votos na falta de regra estatutária. Após dissolução, a sociedade entra em liquidação. O processo pode ser simplificado (via Empresa na Hora) se se verificarem os requisitos do Decreto-Lei n.º 76-A/2006.',
  },
  // Contratos
  {
    slug: 'contrato_cessao', titulo: 'Contrato de Cessão de Quotas', categoria: 'contratos',
    resumo: 'Documento que formaliza a transmissão de uma quota entre o sócio cedente e o cessionário, definindo preço, condições e garantias.',
    quando_usar: 'Obrigatório sempre que haja transmissão de quotas. Deve ser assinado por cedente e cessionário e apresentado à sociedade para registo na conservatória.',
    documentos_necessarios: ['Identificação de ambas as partes', 'Prova de pagamento do preço (se solicitada)', 'Consentimento da sociedade e sócios'],
    notas_legais: 'A cessão de quotas não produz efeitos perante a sociedade antes de lhe ser comunicada ou por ela reconhecida (art. 228.º n.º 2 CSC). O registo definitivo só é possível após o prazo de preferência.',
  },
  {
    slug: 'acordo_parassocial', titulo: 'Acordo Parassocial', categoria: 'contratos',
    resumo: 'Contrato privado entre os sócios que regula aspetos do governo societário não cobertos ou complementares ao pacto social, como direitos de preferência, tag-along, drag-along e matérias reservadas.',
    quando_usar: 'Recomendado quando existem múltiplos sócios com participações significativas e se pretende regular com detalhe as relações entre eles, especialmente em sociedades com sócios fundadores e investidores.',
    documentos_necessarios: ['Identificação de todas as partes', 'Pacto social atualizado (referência)'],
    notas_legais: 'Art. 17.º CSC. Os acordos parassociais são válidos entre as partes mas não são oponíveis à sociedade nem a terceiros. A violação do acordo parassocial gera responsabilidade civil mas não afeta a validade dos atos societários praticados em sentido contrário.',
  },
  {
    slug: 'declaracao_bem_proprio', titulo: 'Declaração de Bem Próprio', categoria: 'contratos',
    resumo: 'Declaração conjunta do sócio e do seu cônjuge a afirmar que o valor investido na sociedade provém de bens próprios do sócio, excluindo-o da comunhão conjugal.',
    quando_usar: 'Necessária quando um sócio casado em regime de comunhão de adquiridos ou comunhão geral realiza uma entrada de capital que, por ser dinheiro próprio, não deve integrar o património comum do casal.',
    documentos_necessarios: ['CC/Passaporte de ambos os cônjuges', 'Prova de que os fundos são bem próprio (extracto, herança, doação)'],
    notas_legais: 'Art. 1723.º al. c) do Código Civil. A declaração deve ser expressa no próprio ato ou em documento autêntico ou autenticado anterior ou coevo. Sem esta declaração, a quota adquirida com dinheiro próprio pode ser considerada bem comum se não se conseguir provar a sua natureza.',
  },
  // Geral
  {
    slug: 'sociedades_quotas', titulo: 'Sociedade por Quotas (Lda.)', categoria: 'geral',
    resumo: 'A sociedade por quotas é o tipo societário mais comum em Portugal. O capital social está dividido em quotas e a responsabilidade dos sócios limita-se ao valor do capital subscrito.',
    quando_usar: 'Forma mais adequada para empresas de pequena e média dimensão, com número reduzido de sócios (tipicamente 2 a 5), que pretendem limitar a responsabilidade pessoal.',
    documentos_necessarios: ['Pacto social', 'Identificação dos sócios fundadores', 'Prova de capital (depósito mínimo de 1€)'],
    notas_legais: 'Arts. 197.º a 270.º CSC. Capital social mínimo: 1€ (mas capital simbólico implica responsabilidade solidária dos sócios durante 5 anos). Capital mínimo recomendado: 5.000€. Número mínimo de sócios: 2 (ou 1 para Unipessoal). Gerência obrigatória por sócio(s) ou terceiro(s).',
  },
  {
    slug: 'sociedades_anonimas', titulo: 'Sociedade Anónima (S.A.)', categoria: 'geral',
    resumo: 'A sociedade anónima é indicada para empresas de maior dimensão. O capital social divide-se em ações livremente transmissíveis, com responsabilidade limitada dos acionistas.',
    quando_usar: 'Empresas com acesso a mercados de capitais, necessidade de muitos acionistas, empresas cotadas em bolsa ou que pretendam estrutura de governance mais robusta.',
    documentos_necessarios: ['Escritura pública de constituição', 'Capital social mínimo: 50.000€', 'Estatutos aprovados', 'Nomeação de ROC obrigatória'],
    notas_legais: 'Arts. 271.º a 464.º CSC. Capital mínimo: 50.000€. Número mínimo de acionistas: 5 (salvo SA unipessoal). Obrigatoriedade de Revisor Oficial de Contas (ROC). Órgão de administração: Conselho de Administração ou Administrador Único.',
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
      await seedContent();
    } else {
      setEntries(data);
      setSelSlug(data[0]?.slug || SEED[0].slug);
    }
  };

  const seedContent = async () => {
    setSeeding(true);
    for (const entry of SEED) {
      await saveWikipediaEntry(entry.slug, entry);
    }
    const data = await listWikipediaEntries();
    setEntries(data);
    setSeeding(false);
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
  const updDocs = (i, v) => setDraft(p => ({ ...p, documentos_necessarios: (p.documentos_necessarios || []).map((x, j) => j === i ? v : x) }));
  const addDoc = () => setDraft(p => ({ ...p, documentos_necessarios: [...(p.documentos_necessarios || []), ''] }));
  const removeDoc = (i) => setDraft(p => ({ ...p, documentos_necessarios: (p.documentos_necessarios || []).filter((_, j) => j !== i) }));

  if (seeding) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 24 }}>📚</div>
      <div style={{ fontSize: 14, color: '#6B7280' }}>A preparar conteúdo inicial...</div>
    </div>
  );

  const displayEntry = editing ? draft : selEntry;

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 64px)', margin: '-32px -40px', overflow: 'hidden' }}>
      {/* Painel esquerdo */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #E5E7EB', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="topbar-brand-tag">WIKIPEDIA JURÍDICA</div>
          <div className="serif" style={{ fontSize: 18, marginTop: 2, fontWeight: 600 }}>Base de conhecimento</div>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, lineHeight: 1.4 }}>Informação de referência para cada tipo de ato societário.</p>
        </div>
        <div style={{ padding: '8px 0' }}>
          {Object.entries(CATS).map(([cid, cl]) => {
            const catEntries = entries.length > 0
              ? entries.filter(e => e.categoria === cid)
              : SEED.filter(e => e.categoria === cid);
            if (catEntries.length === 0) return null;
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
                  }}>
                    {e.titulo}
                  </div>
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
              <h2 className="serif" style={{ fontSize: 24, fontWeight: 600 }}>Editar: {displayEntry.titulo}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={cancelEdit}>Cancelar</Btn>
                <Btn onClick={guardar}>Guardar</Btn>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Resumo</label>
                <textarea value={draft.resumo || ''} onChange={e => updDraft('resumo', e.target.value)} rows={3}
                  className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
              </div>
              <div>
                <label className="field-label">Quando usar</label>
                <textarea value={draft.quando_usar || ''} onChange={e => updDraft('quando_usar', e.target.value)} rows={3}
                  className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="field-label">Documentos necessários</label>
                  <button onClick={addDoc} style={{ fontSize: 12, color: '#8B7355', background: 'none', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
                </div>
                {(draft.documentos_necessarios || []).map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={d} onChange={e => updDocs(i, e.target.value)} className="field-input" style={{ flex: 1 }} />
                    <button onClick={() => removeDoc(i)} style={{ padding: '4px 8px', border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 4, cursor: 'pointer', color: '#B91C1C' }}>✕</button>
                  </div>
                ))}
              </div>
              <div>
                <label className="field-label">Notas legais</label>
                <textarea value={draft.notas_legais || ''} onChange={e => updDraft('notas_legais', e.target.value)} rows={4}
                  className="field-input" style={{ width: '100%', resize: 'vertical', marginTop: 6, lineHeight: 1.6 }} />
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
              <div style={{ marginBottom: 24, padding: 20, background: '#FAF6EE', borderRadius: 8, borderLeft: '4px solid #B8976A' }}>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{displayEntry.resumo}</p>
              </div>
            )}

            {displayEntry.quando_usar && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>Quando usar</h3>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{displayEntry.quando_usar}</p>
              </div>
            )}

            {displayEntry.documentos_necessarios?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#1F2937', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documentos necessários</h3>
                <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
                  {displayEntry.documentos_necessarios.map((d, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14, color: '#374151' }}>
                      <span style={{ color: '#B8976A', fontWeight: 600, flexShrink: 0 }}>→</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {displayEntry.notas_legais && (
              <div style={{ marginBottom: 24, padding: 16, background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas legais</h3>
                <p style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>{displayEntry.notas_legais}</p>
              </div>
            )}

            {!profissional?.is_admin && (
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 24 }}>Para editar este conteúdo, é necessário ter permissões de administrador.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
