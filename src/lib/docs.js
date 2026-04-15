import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const fmtEur = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const PONTOS_EXTENSO = ['Um','Dois','Três','Quatro','Cinco','Seis','Sete','Oito','Nove','Dez'];

function dataExtensoPorExtenso(dataStr) {
  if (!dataStr) return '[DATA]';
  const d = new Date(dataStr);
  if (isNaN(d)) return dataStr;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  spacing: { after: opts.after ?? 200, before: opts.before ?? 0, line: 360 },
  indent: opts.indent ? { left: 720 } : undefined,
  children: [new TextRun({ text: text || '', font: 'Times New Roman', size: 24, bold: !!opts.bold })],
});

function buildDoc(children) {
  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }],
  });
}

async function save(doc, nome) {
  const blob = await Packer.toBlob(doc);
  saveAs(blob, nome);
}

function idSocio(s) {
  if (!s) return '[SÓCIO]';
  if (s.tipo_pessoa === 'coletiva') {
    let r = `${s.firma_socio || '[FIRMA]'}, pessoa coletiva com o número de identificação fiscal ${s.nipc_socio || '[NIPC]'}, com sede em ${s.sede_socio || '[SEDE]'}`;
    if (s.representante_nome) r += `, aqui representada por ${s.representante_nome}${s.representante_cargo ? `, na qualidade de ${s.representante_cargo}` : ''}`;
    return r;
  }
  if (!s.nome) return `[NOME_SOCIO_${s.letra}]`;
  let r = s.nome;
  if (s.estado_civil) {
    r += `, ${s.estado_civil}`;
    if (s.estado_civil === 'casado' && s.regime_bens) r += ` sob o regime da ${s.regime_bens.replace(/_/g, ' ')}`;
    if (s.estado_civil === 'casado' && s.conjuge_nome) r += ` com ${s.conjuge_nome}`;
  }
  if (s.nacionalidade && s.nacionalidade !== 'Portuguesa') r += `, de nacionalidade ${s.nacionalidade}`;
  if (s.natural_freguesia) r += `, natural da freguesia de ${s.natural_freguesia}${s.natural_concelho ? `, concelho de ${s.natural_concelho}` : ''}`;
  if (s.nif) r += `, contribuinte fiscal n.º ${s.nif}`;
  if (s.doc_num) {
    const tipo = s.doc_tipo === 'CC' ? 'Cartão de Cidadão' : s.doc_tipo === 'PASSAPORTE' ? 'Passaporte' : (s.doc_tipo || 'documento');
    r += `, portador(a) do ${tipo} n.º ${s.doc_num}${s.doc_validade ? `, válido até ${s.doc_validade}` : ''}`;
  }
  if (s.morada) r += `, residente em ${s.morada}`;
  return r;
}

const safeName = s => (s || 'doc').replace(/[^a-zA-Z0-9]/g, '_');

// ── ATA ──────────────────────────────────────────────────────────────────────
export async function generateAtaSimples(soc, opts = {}) {
  const hora = opts.hora || '[HORA]';
  const data = opts.data || '[DATA]';
  const numero = opts.numero || '[N.º]';
  const deliberacoes = opts.deliberacoes || [];
  const uni = soc.socios?.length === 1;
  const c = [];

  // Título
  c.push(p(`ATA N.º ${numero}`, { center: true, bold: true, after: 400 }));

  // Abertura
  c.push(p(`Aos ${data}, pelas ${hora} horas, na sede social da sociedade ${soc.tipo?.toLowerCase() || 'por quotas'}, denominada "${soc.firma}", com o número de identificação de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com sede em ${soc.sede || '[SEDE]'} e com o capital social de ${fmtEur(soc.capital)}, ${uni ? 'o sócio único reuniu-se' : 'reuniu-se a Assembleia Geral'} com a seguinte ordem do dia:`));

  // Ordem do dia
  if (deliberacoes.length > 0) {
    deliberacoes.forEach((d, i) => {
      c.push(p(`Ponto ${PONTOS_EXTENSO[i] || i + 1}: ${d}.`, { before: 60, bold: true }));
    });
  } else {
    c.push(p('Ponto Único: [DESCRIÇÃO DA DELIBERAÇÃO].', { before: 60, bold: true }));
  }

  // Cláusula assembleia universal / art. 54.º CSC
  c.push(p(
    'Achando-se presentes ou devidamente representados todos os sócios da sociedade, representantes da totalidade do capital social, e tendo todos declarado consentir na realização da presente reunião e na dispensa de quaisquer formalidades prévias de convocação, nos termos e para os efeitos do artigo 54.º do Código das Sociedades Comerciais, considera-se regularmente constituída a assembleia, podendo deliberar sobre os assuntos constantes da presente ordem do dia.',
    { before: 200 }
  ));

  // Identificação dos sócios presentes
  c.push(p(uni ? 'Encontrava-se presente o sócio:' : 'Encontravam-se presentes os sócios:', { before: 200, bold: true }));
  (soc.socios || []).forEach((s, i) => {
    const libStr = s.quota_liberada ? ', encontrando-se a respetiva quota totalmente liberada' : '';
    c.push(p(
      `${String.fromCharCode(97 + i)}) ${idSocio(s)}, titular de uma quota com o valor nominal de ${fmtEur(s.quota)}, representativa de ${s.pct}% do capital social${libStr}.`,
      { indent: true }
    ));
  });

  // Deliberações — usa clausulas do Atlas se disponíveis, senão texto genérico
  const clausulas = opts.clausulas || [];
  const pontosSource = clausulas.length > 0 ? clausulas : (deliberacoes.length > 0 ? deliberacoes.map(l => ({ label: l, texto: null })) : [{ label: '[PONTO ÚNICO]', texto: null }]);
  pontosSource.forEach((cl, i) => {
    const label = typeof cl === 'string' ? cl : cl.label;
    const texto = typeof cl === 'string' ? null : cl.texto;
    c.push(p(`Ponto ${PONTOS_EXTENSO[i] || i + 1} — ${label}`, { before: 300, bold: true }));
    if (texto) {
      // Split multi-paragraph clause text
      texto.split('\n\n').filter(l => l.trim()).forEach(para => {
        c.push(p(para.trim(), { before: 80 }));
      });
    } else {
      c.push(p('[CONTEÚDO DA DELIBERAÇÃO — preencher manualmente]', { before: 100 }));
    }
    c.push(p('A deliberação foi aprovada por unanimidade dos votos correspondentes à totalidade do capital social.', { before: 100 }));
  });

  // Encerramento
  c.push(p(
    `Nada mais havendo a tratar, ${uni ? 'o sócio único declarou encerrada' : 'o Presidente declarou encerrada'} a reunião pelas [HORA_FIM] horas, da qual se lavrou a presente ata, que, depois de lida e achada conforme, vai ser assinada por todos os sócios que nela participaram.`,
    { before: 400 }
  ));

  // Assinaturas
  (soc.socios || []).forEach(s => {
    c.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
    c.push(p('______________________________'));
    c.push(p(`(${s.nome || s.firma_socio || `[SÓCIO ${s.letra}]`})`));
  });

  await save(buildDoc(c), `Ata_${safeName(soc.firma)}.docx`);
}

// ── LISTA DE SÓCIOS ──────────────────────────────────────────────────────────
export async function generateListaSocios(soc, opts = {}) {
  const data = opts.data || '[DATA]';
  const c = [];
  c.push(p('LISTA DE SÓCIOS', { center: true, bold: true, after: 400 }));
  c.push(p(`${soc.firma}, ${soc.tipo?.toLowerCase() || 'sociedade por quotas'}, com o número de identificação de pessoa coletiva ${soc.nipc}, com sede em ${soc.sede || '[SEDE]'}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmtEur(soc.capital)}, representado pela${(soc.socios?.length || 0) > 1 ? 's seguintes quotas' : ' seguinte quota'}:`));
  (soc.socios || []).forEach((s, i) => {
    const libStr = s.quota_liberada ? ' (quota totalmente liberada)' : '';
    c.push(p(
      `${String.fromCharCode(97 + i)}) Uma quota com o valor nominal de ${fmtEur(s.quota)}, representativa de ${s.pct}% do capital social, pertencente a ${idSocio(s)}${libStr}.`,
      { indent: true }
    ));
  });
  c.push(p(`[LOCAL], ${data}`, { before: 400 }));
  c.push(p((soc.socios?.length || 0) > 1 ? 'Os Sócios,' : 'O Sócio,', { before: 200, bold: true }));
  (soc.socios || []).forEach(s => {
    c.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
    c.push(p('______________________________'));
    c.push(p(`(${s.nome || s.firma_socio || `[SÓCIO ${s.letra}]`})`));
  });
  await save(buildDoc(c), `Lista_Socios_${safeName(soc.firma)}.docx`);
}

// ── CONTRATO DE CESSÃO DE QUOTAS ─────────────────────────────────────────────
export async function generateContratoCessao(soc, opts = {}) {
  const cedente = soc.socios?.find(s => s.id === opts.cedenteId);
  const cessionario = soc.socios?.find(s => s.id === opts.cessionarioId);
  const data = opts.data || '[DATA]';
  const local = opts.local || 'Lisboa';
  const c = [];

  c.push(p('CONTRATO DE CESSÃO DE QUOTAS', { center: true, bold: true, after: 100 }));
  c.push(p(`"${soc.firma}"`, { center: true, bold: true, after: 400 }));

  c.push(p('Entre:', { bold: true }));
  c.push(p(`a) ${cedente ? idSocio(cedente) : '[CEDENTE — identificação completa]'}, adiante designado por "Cedente";`));
  c.push(p('e', { center: true, bold: true, before: 100, after: 100 }));
  c.push(p(`b) ${cessionario ? idSocio(cessionario) : '[CESSIONÁRIO — identificação completa]'}, adiante designado por "Cessionário";`));

  c.push(p('é celebrado o presente contrato de cessão de quotas, que se rege pelas cláusulas seguintes:', { before: 200 }));

  c.push(p('Cláusula 1.ª — Sociedade e quota cedida', { bold: true, center: true, before: 300 }));
  c.push(p(`1. O Cedente é sócio da sociedade ${soc.tipo?.toLowerCase() || 'por quotas'} "${soc.firma}", com sede em ${soc.sede || '[SEDE]'}, matriculada na Conservatória do Registo Comercial sob o número único de matrícula e de identificação de pessoa coletiva ${soc.nipc}, com o capital social de ${fmtEur(soc.capital)}, integralmente realizado, adiante designada por "Sociedade".`));
  c.push(p(`2. O Cedente é titular de uma quota com o valor nominal de ${cedente ? fmtEur(cedente.quota) : '[VALOR]'}, representativa de ${cedente?.pct || '[%]'}% do capital social da Sociedade.`));

  c.push(p('Cláusula 2.ª — Objeto da cessão', { bold: true, center: true, before: 300 }));
  c.push(p('1. Pelo presente contrato, o Cedente cede ao Cessionário, que aceita, a quota identificada na cláusula anterior, com todos os direitos e obrigações a ela inerentes.'));
  c.push(p('2. A cessão é efetuada livre de quaisquer ónus, encargos, direitos de terceiros ou limitações à sua livre transmissão, incluindo penhoras, arrestos, usufrutos ou direitos de opção, com exceção dos direitos de preferência legal ou contratual dos demais sócios, já exercidos ou aos quais renunciaram.'));

  c.push(p('Cláusula 3.ª — Preço e pagamento', { bold: true, center: true, before: 300 }));
  c.push(p(`1. A cessão é efetuada pelo preço global de ${fmtEur(opts.valor)} (${fmtEur(opts.valor)} euros).`));
  c.push(p('2. O Cessionário declara pagar ao Cedente o referido preço na presente data, em numerário/por transferência bancária, ficando o Cedente integralmente quitado com o recebimento do referido montante.'));
  c.push(p('3. Com o pagamento do preço, o Cedente declara nada mais ter a receber do Cessionário, a qualquer título, em consequência da presente cessão.'));

  c.push(p('Cláusula 4.ª — Consentimento e direito de preferência', { bold: true, center: true, before: 300 }));
  c.push(p('As partes declaram que foram observadas todas as formalidades legais e contratuais relativas ao consentimento para a cessão da quota, nos termos dos artigos 228.º e seguintes do Código das Sociedades Comerciais, tendo os demais sócios exercido, renunciado ou deixado decorrer o prazo para o exercício do respetivo direito de preferência.'));

  c.push(p('Cláusula 5.ª — Declarações e garantias do Cedente', { bold: true, center: true, before: 300 }));
  c.push(p('O Cedente declara e garante que: a) é o único e legítimo titular da quota cedida; b) a quota se encontra livre de quaisquer ónus ou encargos; c) a quota se encontra integralmente realizada; d) não existem acordos parassociais que limitem a sua transmissão além dos já comunicados ao Cessionário.'));

  c.push(p('Cláusula 6.ª — Eficácia e registo', { bold: true, center: true, before: 300 }));
  c.push(p('1. A transmissão da posição de sócio considera-se eficaz entre as partes na data da assinatura do presente contrato, sem prejuízo da produção de efeitos perante a Sociedade e terceiros a partir do registo comercial da cessão.'));
  c.push(p('2. As partes obrigam-se a praticar todos os atos e assinar todos os documentos necessários à alteração do contrato de sociedade e ao registo comercial da presente cessão.'));

  c.push(p('Cláusula 7.ª — Despesas', { bold: true, center: true, before: 300 }));
  c.push(p('Todas as despesas, encargos e impostos inerentes à presente cessão, incluindo os custos de registo comercial, serão suportados pelo Cessionário, sem prejuízo das obrigações legais que competirem a cada parte.'));

  c.push(p('Cláusula 8.ª — Foro', { bold: true, center: true, before: 300 }));
  c.push(p(`Para a resolução de quaisquer litígios emergentes da interpretação ou execução do presente contrato, é competente o foro da comarca de ${local}, com expressa renúncia a qualquer outro.`));

  c.push(p(`Feito em ${local}, a ${data}, em dois exemplares.`, { before: 400 }));
  c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`O Cedente`));
  c.push(p(`(${cedente?.nome || cedente?.firma_socio || '[CEDENTE]'})`));
  c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`O Cessionário`));
  c.push(p(`(${cessionario?.nome || cessionario?.firma_socio || '[CESSIONÁRIO]'})`));

  await save(buildDoc(c), `Contrato_Cessao_${safeName(soc.firma)}.docx`);
}

// ── ACORDO PARASSOCIAL ────────────────────────────────────────────────────────
export async function generateAcordoParassocial(soc, opts = {}) {
  const c = [];
  c.push(p('ACORDO PARASSOCIAL', { center: true, bold: true, after: 100 }));
  c.push(p(`${soc.firma} — Art. 17.º CSC`, { center: true, after: 400 }));
  c.push(p('Preâmbulo', { bold: true, center: true }));
  c.push(p('Entre:', { bold: true, before: 200 }));
  (soc.socios || []).forEach((s, i) => {
    const ord = ['Primeiro', 'Segundo', 'Terceiro', 'Quarto'][i] || `${i + 1}.º`;
    c.push(p(`${i + 1}. ${idSocio(s)}, doravante designado por "Parte ${String.fromCharCode(65 + i)}" ou "${ord} Outorgante";`));
  });
  c.push(p(`Os outorgantes são doravante designados em conjunto por "Partes" e individualmente por "Parte".`, { before: 200 }));
  c.push(p(`a) As Partes são sócias da sociedade "${soc.firma}", ${soc.tipo?.toLowerCase() || 'sociedade por quotas'}, com sede em ${soc.sede || '[SEDE]'}, NIPC ${soc.nipc}, com o capital social de ${fmtEur(soc.capital)}, adiante designada por "Sociedade";`, { before: 200 }));
  c.push(p('b) As Partes pretendem regular, por via do presente acordo parassocial, certos aspetos das suas relações recíprocas enquanto sócias da Sociedade, na medida em que tal seja compatível com o contrato de sociedade e com a lei.'));

  const cls = [
    ['Cláusula 1.ª — Objeto e prevalência', '1. O presente acordo tem por objeto regular: a) O exercício dos direitos de voto; b) A composição e funcionamento dos órgãos sociais; c) As regras de transmissão das participações sociais; d) Obrigações de não concorrência e de confidencialidade; e) Mecanismos de resolução de conflitos.\n2. O presente acordo é celebrado nos termos do artigo 17.º do Código das Sociedades Comerciais, vinculando exclusivamente as Partes, não podendo prejudicar direitos de terceiros de boa-fé.'],
    ['Cláusula 2.ª — Duração', '1. O presente acordo entra em vigor na data da sua assinatura e manter-se-á em vigor enquanto as Partes forem sócias da Sociedade.\n2. Qualquer Parte pode denunciar o presente acordo mediante comunicação escrita às restantes Partes, com antecedência mínima de 90 dias, sem prejuízo das obrigações que, pela sua natureza, devam subsistir.'],
    ['Cláusula 3.ª — Matérias reservadas', `As seguintes matérias dependem de deliberação unânime das Partes: a) Alteração do contrato de sociedade; b) Aumento ou redução do capital social; c) Nomeação e destituição de gerentes; d) Alienação ou oneração de ativos cujo valor exceda ${fmtEur(opts.limite_inv || 50000)}; e) Financiamentos ou obrigações superiores a ${fmtEur(opts.limite_cont || 85000)}; f) Aprovação do orçamento anual.`],
    ['Cláusula 4.ª — Direito de preferência', '1. Em caso de intenção de qualquer Parte de alienar, por ato entre vivos, total ou parcialmente, as participações que detenha na Sociedade, deverá comunicar por escrito às demais Partes, indicando o número de quotas a alienar, o preço e as demais condições essenciais.\n2. As demais Partes gozam de direito de preferência a exercer no prazo de 30 dias a contar da receção da comunicação, em condições não menos favoráveis do que as oferecidas pelo terceiro.'],
    ['Cláusula 5.ª — Tag-Along', 'No caso de qualquer Parte pretender vender a um terceiro uma participação igual ou superior a 20% do capital social da Sociedade, as demais Partes terão o direito de exigir que o referido terceiro adquira simultaneamente as suas participações, em proporção e nas mesmas condições aplicáveis ao Sócio Alienante.'],
    ['Cláusula 6.ª — Não concorrência', '1. Durante a vigência do presente acordo e pelo período de 12 meses após a cessação da qualidade de sócio, cada Parte obriga-se a não exercer, direta ou indiretamente, qualquer atividade que seja concorrente com o objeto social da Sociedade.\n2. A obrigação é limitada no tempo, no objeto e ao território português.'],
    ['Cláusula 7.ª — Confidencialidade', '1. As Partes obrigam-se a manter confidenciais todas as informações comerciais, financeiras, técnicas ou estratégicas relativas à Sociedade.\n2. A obrigação de confidencialidade manter-se-á por um período de 3 anos após a cessação do presente acordo, não se aplicando às informações que se tornem públicas por facto não imputável à Parte que as divulga ou que sejam exigidas por lei ou autoridade competente.'],
    ['Cláusula 8.ª — Resolução de litígios', '1. As Partes envidarão os melhores esforços para resolver amigavelmente quaisquer litígios emergentes do presente acordo.\n2. Na falta de solução amigável no prazo de 30 dias após notificação escrita do litígio, o mesmo será resolvido pelos Tribunais Judiciais da comarca da sede da Sociedade.'],
    ['Cláusula 9.ª — Disposições finais', '1. O presente acordo não substitui o contrato de sociedade da Sociedade.\n2. Qualquer alteração ao presente acordo deverá ser feita por escrito e assinada por todas as Partes.\n3. Feito em [LOCAL], a [DATA].'],
  ];
  cls.forEach(([t, txt]) => {
    c.push(p(t, { bold: true, center: true, before: 300 }));
    txt.split('\n').forEach(line => c.push(p(line)));
  });

  (soc.socios || []).forEach((s, i) => {
    const ord = ['Primeiro', 'Segundo', 'Terceiro', 'Quarto'][i] || `${i + 1}.º`;
    c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
    c.push(p(`O ${ord} Outorgante`));
    c.push(p('______________________________'));
    c.push(p(`(${s.nome || s.firma_socio || `[SÓCIO ${s.letra}]`})`));
  });
  await save(buildDoc(c), `Acordo_Parassocial_${safeName(soc.firma)}.docx`);
}

// ── DECLARAÇÃO DE BEM PRÓPRIO ─────────────────────────────────────────────────
export async function generateDeclaracaoBemProprio(soc, opts = {}) {
  const s = soc.socios?.find(x => x.id === opts.socioId);
  if (!s || s.estado_civil !== 'casado') { alert('Sócio selecionado não é casado.'); return; }
  const c = [];
  c.push(p('DECLARAÇÃO DE BEM PRÓPRIO', { center: true, bold: true, after: 400 }));
  c.push(p(`${s.nome}, ${s.estado_civil} com ${s.conjuge_nome || '[CÔNJUGE]'} sob o regime da ${(s.regime_bens || '').replace(/_/g, ' ')}, NIF ${s.nif || '[NIF]'}, portador(a) do ${s.doc_tipo || 'CC'} n.º ${s.doc_num || '[DOC]'}${s.doc_validade ? `, válido até ${s.doc_validade}` : ''}, residente em ${s.morada || '[MORADA]'},`));
  c.push(p('DECLARA para os devidos efeitos legais, nomeadamente para efeitos do disposto nos artigos 1722.º e seguintes do Código Civil, que:', { before: 200, bold: true }));
  c.push(p(`O capital empregue na aquisição da quota/participação social com o valor nominal de ${fmtEur(s.quota)} na sociedade "${soc.firma}", NIPC ${soc.nipc}, tem a natureza de bem próprio, por provir de [herança / doação / outro], não integrando o património comum do casal.`, { before: 200 }));
  c.push(p(`O cônjuge ${s.conjuge_nome || '[CÔNJUGE]'}, NIF ${s.conjuge_nif || '[NIF]'}, portador(a) do documento n.º ${s.conjuge_doc_num || '[DOC]'}${s.conjuge_doc_validade ? `, válido até ${s.conjuge_doc_validade}` : ''}, está ciente e concorda com o teor da presente declaração, reconhecendo a natureza de bem próprio da participação social acima referida.`, { before: 200 }));
  c.push(p('Feita de livre vontade, para os efeitos tidos por convenientes.', { before: 300 }));
  c.push(p('[LOCAL], [DATA]', { before: 400, bold: true }));
  c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`(${s.nome})`));
  c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`(${s.conjuge_nome || '[CÔNJUGE]'})`));
  await save(buildDoc(c), `Declaracao_Bem_Proprio_${safeName(soc.firma)}.docx`);
}
