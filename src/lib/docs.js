import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const fmt = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 },
  indent: opts.indent ? { left: 720 } : undefined,
  children: [new TextRun({ text: text || '', font: 'Times New Roman', size: 24, bold: opts.bold })],
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
  if (!s.nome) return `[NOME_SOCIO_${s.letra}]`;
  let r = `${s.nome}, ${s.estado_civil || '[estado civil]'}`;
  if (s.estado_civil === 'casado' && s.regime_bens) r += ` sob o regime da ${s.regime_bens.replace(/_/g, ' ')}`;
  if (s.natural_freguesia) r += `, natural da freguesia de ${s.natural_freguesia}${s.natural_concelho ? `, concelho de ${s.natural_concelho}` : ''}`;
  if (s.nif) r += `, NIF ${s.nif}`;
  if (s.doc_num) r += `, portador(a) do ${s.doc_tipo || 'CC'} n.º ${s.doc_num}${s.doc_validade ? `, válido até ${s.doc_validade}` : ''}, emitido pela República Portuguesa`;
  if (s.morada) r += `, residente em ${s.morada}`;
  return r;
}

const safeName = s => (s || 'doc').replace(/[^a-zA-Z0-9]/g, '_');

// ── ATA SIMPLES ─────────────────────────────────────────────────────────
export async function generateAtaSimples(soc, opts = {}) {
  const uni = soc.socios?.length === 1;
  const c = [];
  c.push(p(`ATA NÚMERO ${opts.numero || '[Nº]'}`, { center: true, bold: true, after: 400 }));
  c.push(p(`Aos ${opts.data || '[DATA]'}, pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede || '[SEDE]'}, a Assembleia Geral Extraordinária da sociedade ${soc.tipo?.toLowerCase() || 'por quotas'}, denominada "${soc.firma}", com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)}.`));
  c.push(p(uni ? 'Encontrava-se presente o sócio:' : 'Encontravam-se presentes os sócios:', { before: 200, bold: true }));
  (soc.socios || []).forEach((s, i) => c.push(p(`${String.fromCharCode(97 + i)}) ${idSocio(s)}, titular de uma quota de ${fmt(s.quota)}, correspondente a ${s.pct}% do capital social.`, { indent: true })));
  c.push(p('Verificando-se estar reunida a totalidade do capital social e tendo sido dispensadas todas as formalidades prévias de convocação nos termos do artigo 54.º do Código das Sociedades Comerciais, foi manifestada a vontade de que a assembleia se constituísse e deliberasse sobre a seguinte ordem de trabalhos:', { before: 200 }));
  c.push(p('Ponto Um: [PONTO]', { bold: true, before: 200 }));
  c.push(p('[CONTEÚDO DA DELIBERAÇÃO]', { before: 200 }));
  c.push(p('Nada mais havendo a tratar, foi encerrada a sessão pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelos presentes, em sinal de conformidade.', { before: 400 }));
  (soc.socios || []).forEach(s => {
    c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
    c.push(p('______________________________'));
    c.push(p(s.nome || `[NOME_SOCIO_${s.letra}]`));
  });
  await save(buildDoc(c), `Ata_${safeName(soc.firma)}.docx`);
}

// ── LISTA DE SÓCIOS ─────────────────────────────────────────────────────
export async function generateListaSocios(soc) {
  const c = [];
  c.push(p('LISTA DE SÓCIOS', { center: true, bold: true, after: 400 }));
  c.push(p(`${soc.firma}, ${soc.tipo?.toLowerCase()}, com o número de pessoa coletiva ${soc.nipc}, com sede em ${soc.sede}, com o capital social de ${fmt(soc.capital)}, representado pela${(soc.socios?.length || 0) > 1 ? 's seguintes quotas' : ' seguinte quota'}:`));
  (soc.socios || []).forEach((s, i) => c.push(p(`${String.fromCharCode(97 + i)}) Uma quota com o valor nominal de ${fmt(s.quota)}, representativa de ${s.pct}% do capital social, pertencente a ${idSocio(s)}.`, { indent: true })));
  c.push(p('[LOCAL], [DATA]', { before: 400 }));
  c.push(p((soc.socios?.length || 0) > 1 ? 'Os Sócios,' : 'O Sócio,', { before: 200, bold: true }));
  (soc.socios || []).forEach(s => {
    c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
    c.push(p('______________________________'));
    c.push(p(s.nome || `[NOME_SOCIO_${s.letra}]`));
  });
  await save(buildDoc(c), `Lista_Socios_${safeName(soc.firma)}.docx`);
}

// ── CONTRATO DE CESSÃO ──────────────────────────────────────────────────
export async function generateContratoCessao(soc, opts = {}) {
  const cedente = soc.socios?.find(s => s.id === opts.cedenteId);
  const cessionario = soc.socios?.find(s => s.id === opts.cessionarioId);
  const c = [];
  c.push(p('CONTRATO DE CESSÃO DE QUOTAS', { center: true, bold: true, after: 200 }));
  c.push(p(`"${soc.firma}"`, { center: true, bold: true, after: 400 }));
  c.push(p('ENTIDADE:', { bold: true }));
  c.push(p(`"${soc.firma}", ${soc.tipo?.toLowerCase()}, com sede em ${soc.sede}, NIPC ${soc.nipc}, com o capital social de ${fmt(soc.capital)}.`));
  c.push(p('ENTRE:', { bold: true, before: 200 }));
  c.push(p(`${cedente ? idSocio(cedente) : '[CEDENTE]'}, doravante designado por Cedente;`));
  c.push(p('E', { bold: true, center: true }));
  c.push(p(`${cessionario ? idSocio(cessionario) : '[CESSIONÁRIO]'}, doravante designado por Cessionário.`));
  c.push(p('CLÁUSULA PRIMEIRA — Objeto', { bold: true, center: true, before: 300 }));
  c.push(p(`O Cedente cede ao Cessionário, que aceita, a sua quota no valor nominal de ${cedente ? fmt(cedente.quota) : '[VALOR]'}, correspondente a ${cedente?.pct || '[%]'}% do capital social.`));
  c.push(p('CLÁUSULA SEGUNDA — Preço', { bold: true, center: true, before: 300 }));
  c.push(p(`A cessão é efetuada pelo preço global de ${fmt(opts.valor)}, pago pelo Cessionário ao Cedente na presente data.`));
  c.push(p('CLÁUSULA TERCEIRA — Declarações', { bold: true, center: true, before: 300 }));
  c.push(p('O Cedente declara que é dono e legítimo titular da quota, que se encontra livre de quaisquer ónus, encargos ou restrições.'));
  c.push(p('CLÁUSULA QUARTA — Foro', { bold: true, center: true, before: 300 }));
  c.push(p('Para resolução de quaisquer litígios, fica designado o tribunal competente do distrito da sede da sociedade.'));
  c.push(p(`Feito em ${opts.local || 'Lisboa'}, a [DATA].`, { before: 400 }));
  c.push(p('Pelo Cedente,', { before: 200 }));
  c.push(p('______________________________'));
  c.push(p(cedente?.nome || '[NOME_CEDENTE]'));
  c.push(p('Pelo Cessionário,', { before: 300 }));
  c.push(p('______________________________'));
  c.push(p(cessionario?.nome || '[NOME_CESSIONÁRIO]'));
  await save(buildDoc(c), `Contrato_Cessao_${safeName(soc.firma)}.docx`);
}

// ── ACORDO PARASSOCIAL (modelo TRIQBRIQ resumido) ──────────────────────
export async function generateAcordoParassocial(soc, opts = {}) {
  const c = [];
  c.push(p('ACORDO PARASSOCIAL', { center: true, bold: true, after: 100 }));
  c.push(p(`${soc.firma} — Art. 17.º CSC`, { center: true, after: 400 }));
  c.push(p('PREÂMBULO', { bold: true, center: true }));
  c.push(p('Entre:', { bold: true, before: 200 }));
  (soc.socios || []).forEach((s, i) => {
    const ord = ['Primeiro', 'Segunda', 'Terceiro', 'Quarta'][i] || `${i + 1}.º`;
    c.push(p(`${i + 1}. ${idSocio(s)}, doravante "Parte ${String.fromCharCode(65 + i)}" ou "${ord} Outorgante";`));
  });
  c.push(p(`Considerando que as Partes são titulares da totalidade do capital social da sociedade ${soc.firma}, e que pretendem regular aspetos complementares ao pacto social, é celebrado o presente acordo parassocial nos termos do artigo 17.º do Código das Sociedades Comerciais:`, { before: 200 }));

  const cls = [
    ['CLÁUSULA PRIMEIRA — Objeto', 'O presente acordo regula os direitos e obrigações recíprocas das Partes enquanto sócias da Sociedade, em complemento ao pacto social, em matéria de governo societário, transferência de quotas, resolução de impasses, financiamento e saída.'],
    ['CLÁUSULA SEGUNDA — Vigência', '1. O acordo entra em vigor na data da assinatura e mantém-se enquanto ambas as Partes forem sócias.\n2. Pode ser alterado ou revogado por acordo escrito de todas as Partes.'],
    ['CLÁUSULA TERCEIRA — Matérias reservadas', `As seguintes matérias dependem de deliberação unânime das Partes:\na) Alteração do pacto social;\nb) Aumento ou redução do capital social;\nc) Fusão, cisão, transformação ou dissolução;\nd) Nomeação e destituição de gerentes;\ne) Aquisição, alienação ou oneração de imóveis ou participações;\nf) Garantias pessoais ou reais em nome da Sociedade;\ng) Financiamentos ou obrigações superiores a ${fmt(opts.limite_inv || 50000)};\nh) Contratos superiores a ${fmt(opts.limite_cont || 85000)};\ni) Aprovação do orçamento anual;\nj) Admissão de novos sócios.`],
    ['CLÁUSULA QUARTA — Direito de preferência', '1. Nenhuma Parte poderá ceder a sua quota a terceiros sem oferecer previamente a aquisição às outras Partes nas mesmas condições.\n2. A Parte cedente notifica por escrito a intenção de cessão, identificando o adquirente, preço e condições.\n3. As Partes notificadas dispõem de 60 dias para exercer o direito de preferência.'],
    ['CLÁUSULA QUINTA — Tag-Along', 'Caso uma Parte pretenda ceder a totalidade da sua quota a terceiro e o direito de preferência não tenha sido exercido, as outras Partes têm o direito de exigir a inclusão das suas quotas na mesma transação, nas mesmas condições.'],
    ['CLÁUSULA SEXTA — Drag-Along', 'Caso uma Parte receba uma proposta bona fide para aquisição da totalidade do capital social aprovada pela maioria das Partes, as restantes ficam obrigadas a ceder as suas quotas nas mesmas condições, desde que o preço seja determinado por avaliação independente.'],
    ['CLÁUSULA SÉTIMA — Distribuição de lucros', '1. Sem prejuízo da reserva legal e necessidades de tesouraria, será distribuído anualmente, no mínimo, 20% dos lucros líquidos distribuíveis.\n2. A distribuição é deliberada até 30 dias após a aprovação das contas e paga em 60 dias.'],
    ['CLÁUSULA OITAVA — Resolução de impasses', '1. Em caso de impasse, as Partes negociarão diretamente durante 30 dias.\n2. Persistindo, qualquer Parte pode requerer mediação pelo Centro de Arbitragem Comercial.\n3. Em último caso, aplica-se cláusula shotgun: qualquer Parte pode oferecer comprar a quota da outra, que tem 60 dias para aceitar ou contra-comprar pelo mesmo preço.'],
    ['CLÁUSULA NONA — Não concorrência', '1. Durante a vigência do acordo, nenhuma Parte poderá exercer atividades concorrentes com o objeto social, sem consentimento prévio escrito das demais.\n2. Após saída, a obrigação mantém-se por 12 meses.'],
    ['CLÁUSULA DÉCIMA — Confidencialidade', '1. As Partes mantêm sigilo sobre o acordo, a Sociedade e as negociações.\n2. A obrigação mantém-se 24 meses após a extinção do acordo.'],
    ['CLÁUSULA DÉCIMA-PRIMEIRA — Lei aplicável', '1. O acordo rege-se pela lei portuguesa.\n2. Litígios são resolvidos por arbitragem no Centro de Arbitragem Comercial da Câmara de Comércio e Indústria Portuguesa.'],
  ];
  cls.forEach(([t, txt]) => { c.push(p(t, { bold: true, center: true, before: 300 })); txt.split('\n').forEach(line => c.push(p(line))); });

  c.push(p(`Feito em [LOCAL], a [DATA].`, { before: 400 }));
  (soc.socios || []).forEach((s, i) => {
    const ord = ['Primeiro', 'Segunda', 'Terceiro', 'Quarta'][i] || `${i + 1}.º`;
    c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    c.push(p(`O ${ord} Outorgante`));
    c.push(p('______________________________'));
    c.push(p(s.nome || `[NOME_${s.letra}]`));
  });
  await save(buildDoc(c), `Acordo_Parassocial_${safeName(soc.firma)}.docx`);
}

// ── DECLARAÇÃO DE BEM PRÓPRIO ──────────────────────────────────────────
export async function generateDeclaracaoBemProprio(soc, opts = {}) {
  const s = soc.socios?.find(x => x.id === opts.socioId);
  if (!s || s.estado_civil !== 'casado') {
    alert('Sócio selecionado não é casado.');
    return;
  }
  const c = [];
  c.push(p('DECLARAÇÃO DE BEM PRÓPRIO', { center: true, bold: true, after: 400 }));
  c.push(p('ENTRE:', { bold: true }));
  c.push(p(`${s.conjuge_nome || '[CÔNJUGE]'}, NIF ${s.conjuge_nif || '[NIF]'}, portador(a) do documento n.º ${s.conjuge_doc_num || '[DOC]'}${s.conjuge_doc_validade ? `, válido até ${s.conjuge_doc_validade}` : ''}.`));
  c.push(p('E', { bold: true, center: true }));
  c.push(p(`${idSocio(s)}.`));
  c.push(p(`Casados entre si sob o regime da ${(s.regime_bens || '').replace(/_/g, ' ')}, no ordenamento jurídico Português, residentes em ${s.morada || '[MORADA]'}.`, { before: 200 }));
  c.push(p('Declaram que:', { bold: true, before: 300 }));
  c.push(p(`O valor utilizado para a realização da participação social, com o valor nominal de ${fmt(s.quota)}, que ${s.nome} subscreveu na sociedade ${soc.firma}, NIPC ${soc.nipc}, é efetuado como bem próprio, não integrando o património comum do casal, nos termos da alínea c) do artigo 1723.º do Código Civil, dando ${s.conjuge_nome || '[CÔNJUGE]'} o seu expresso consentimento para o efeito.`, { before: 200 }));
  c.push(p('A presente declaração é prestada de livre vontade para os efeitos tidos por convenientes.', { before: 200 }));
  c.push(p('[LOCAL], [DATA]', { before: 400, bold: true }));
  c.push(p('Os declarantes,', { before: 200, bold: true }));
  c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`(${s.nome})`));
  c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  c.push(p('______________________________'));
  c.push(p(`(${s.conjuge_nome || '[CÔNJUGE]'})`));
  await save(buildDoc(c), `Declaracao_Bem_Proprio_${safeName(soc.firma)}.docx`);
}
