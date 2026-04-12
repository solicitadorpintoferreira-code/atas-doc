import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { formatarIdentificacao } from "./identidades.jsx";

const fmt = v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);

const p = (text, opts = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 },
  indent: opts.indent ? { left: 720 } : undefined,
  children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold })],
});

const clausula = (titulo, subtitulo) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 60 }, children: [new TextRun({ text: titulo, font: "Times New Roman", size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: subtitulo, font: "Times New Roman", size: 24, bold: true })] }),
];

function buildDoc(children) {
  return new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }],
  });
}

async function savIt(doc, nome) {
  const blob = await Packer.toBlob(doc);
  saveAs(blob, nome);
}

// ── DECLARAÇÃO DE BEM PRÓPRIO ──────────────────────────────────────────
export async function generateBemProprio(soc, identidades, contexto) {
  const socioId = contexto.socioId;
  const id = identidades[socioId];
  if (!id || id.tipo !== "singular" || id.estadoCivil !== "casado") {
    alert("Declaração de Bem Próprio só se aplica a sócio pessoa singular casada em comunhão.");
    return;
  }

  const c = [];
  c.push(p("DECLARAÇÃO DE BEM PRÓPRIO", { center: true, bold: true, after: 400 }));
  c.push(p("ENTRE:", { bold: true, before: 200 }));
  c.push(p(`${id.conjugeNome}, de nacionalidade ${id.nacionalidade || "Portuguesa"}, NIF ${id.conjugeNif}, portador(a) do documento n.º ${id.conjugeDocNum}${id.conjugeDocValidade ? `, válido até ${id.conjugeDocValidade}` : ""}, emitido pela República Portuguesa.`));
  c.push(p("E", { center: true, bold: true, before: 200 }));
  c.push(p(formatarIdentificacao(id) + "."));
  c.push(p(`Casados entre si sob o regime da ${id.regimeBens === "comunhao_adquiridos" ? "comunhão de bens adquiridos" : id.regimeBens === "comunhao_geral" ? "comunhão geral de bens" : "comunhão"}, no ordenamento jurídico Português, residentes em ${id.morada}.`, { before: 200 }));
  c.push(p("Declaram que:", { bold: true, before: 300 }));
  c.push(p(`O valor utilizado para a realização da participação social${contexto.valor ? `, com o valor nominal de ${fmt(contexto.valor)}` : ""}, que o cônjuge ${id.nome} irá subscrever e realizar na sociedade ${soc.firma}, pessoa coletiva n.º ${soc.nipc}, com o capital social de ${fmt(soc.capital)} e sede em ${soc.sede}, é efetuado como bem próprio, não integrando o património comum do casal, nos termos da alínea c) do artigo 1723.º do Código Civil, dando ${id.conjugeNome} o seu expresso consentimento para o efeito.`, { before: 200 }));
  c.push(p("A presente declaração é prestada de livre vontade para os efeitos tidos por convenientes, designadamente para instrução dos atos societários relativos à entrada no capital social da referida sociedade.", { before: 200 }));
  c.push(p(`${contexto.local || "Lisboa"}, ${contexto.data || "[DATA]"}`, { before: 400, bold: true }));
  c.push(p("Os declarantes,", { before: 200, bold: true }));
  c.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  c.push(p("______________________________"));
  c.push(p(`(${id.nome})`));
  c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  c.push(p("______________________________"));
  c.push(p(`(${id.conjugeNome})`));

  await savIt(buildDoc(c), `Declaracao_Bem_Proprio_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

// ── RENÚNCIA A CRÉDITOS LABORAIS ───────────────────────────────────────
export async function generateRenunciaLaboral(soc, identidades, contexto) {
  const renunciantes = (contexto.renunciantes || []).map(sid => identidades[sid]).filter(Boolean);
  const socios = (contexto.sociosAtuais || []).map(sid => identidades[sid]).filter(Boolean);

  const c = [];
  c.push(p("ACORDO DE RENÚNCIA DEFINITIVA A CRÉDITOS LABORAIS E REMUNERATÓRIOS", { center: true, bold: true, after: 300 }));
  c.push(p(`"${soc.firma}"`, { center: true, bold: true, after: 400 }));
  c.push(p("ENTIDADE:", { bold: true }));
  c.push(p(`"${soc.firma}", ${soc.tipo.toLowerCase()}, com sede em ${soc.sede}, pessoa coletiva número ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)}.`));

  c.push(p("ENTRE:", { bold: true, before: 200 }));
  renunciantes.forEach((r, i) => {
    const ord = ["Primeira", "Segunda", "Terceira", "Quarta"][i] || `${i + 1}.ª`;
    c.push(p(`${formatarIdentificacao(r)}, doravante designad${r.tipo === "singular" && r.nome ? "a" : "o"} por ${ord} Outorgante ou ${ord === "Primeira" ? "Primeira" : ord} Renunciante;`, { before: 120 }));
    if (i < renunciantes.length - 1) c.push(p("E", { center: true, bold: true }));
  });
  if (socios.length > 0) c.push(p("E", { center: true, bold: true }));
  socios.forEach((s, i) => {
    const ord = ["Terceira", "Quarto", "Quinta"][i] || `${i + 3}.º`;
    c.push(p(`${formatarIdentificacao(s)}, doravante designad${s.tipo === "singular" && s.nome ? "a" : "o"} por ${ord} Outorgante ou Sócio(a);`, { before: 120 }));
  });

  c.push(p("Considerando que:", { bold: true, before: 300 }));
  c.push(p("I. As Renunciantes foram sócias da Sociedade até à data da cessão das respetivas quotas;"));
  c.push(p("II. No decurso da relação existente entre as Renunciantes e a Sociedade, foram exercidas funções ou colaborações de diversa natureza, independentemente da qualificação jurídica que lhes tenha sido atribuída;"));
  c.push(p("III. As Partes pretendem regular de forma completa, definitiva e irrevogável quaisquer eventuais direitos, créditos ou expectativas de crédito emergentes dessa relação passada."));

  const cl = [
    ["CLÁUSULA PRIMEIRA", "(Objeto)", "O presente acordo tem por objeto a renúncia expressa, definitiva e irrevogável das Renunciantes a quaisquer créditos, direitos ou expectativas de crédito de natureza laboral, remuneratória, societária ou equiparada, emergentes de qualquer relação passada com a Sociedade, bem como a atribuição de plena quitação à Sociedade."],
    ["CLÁUSULA SEGUNDA", "(Reconhecimento da inexistência de vínculo)", "1. As Renunciantes reconhecem e declaram que, à data da assinatura do presente acordo, não mantêm qualquer vínculo laboral, de prestação de serviços, mandato ou equiparado com a Sociedade, nem exercem quaisquer funções de facto ou de direito na estrutura organizativa da Sociedade.\n2. Não subsiste qualquer relação jurídica ativa suscetível de gerar direitos remuneratórios futuros."],
    ["CLÁUSULA TERCEIRA", "(Renúncia expressa e abrangente)", "1. As Renunciantes renunciam expressa, livre e irrevogavelmente a quaisquer créditos, direitos ou expectativas de crédito, independentemente da sua designação, causa ou natureza, nomeadamente salários, subsídios, prémios, indemnizações, trabalho suplementar e quaisquer valores de natureza laboral, fiscal ou equiparada.\n2. A renúncia abrange créditos vencidos, vincendos, condicionais, contingentes ou eventuais, ainda que à presente data desconhecidos."],
    ["CLÁUSULA QUARTA", "(Quitação plena, geral e definitiva)", "1. As Renunciantes declaram que, com a assinatura do presente acordo, nada mais têm a exigir da Sociedade, a qualquer título, causa ou fundamento.\n2. Conferem à Sociedade plena, geral, definitiva e irrevogável quitação, com efeitos liberatórios totais."],
    ["CLÁUSULA QUINTA", "(Renúncia ao exercício de ações e direitos)", "1. As Renunciantes obrigam-se a não intentar, nem promover, direta ou indiretamente, qualquer ação, reclamação, denúncia ou procedimento contra a Sociedade, designadamente ações judiciais, reclamações junto da ACT, Segurança Social ou Autoridade Tributária, nem procedimentos administrativos ou contraordenacionais.\n2. A presente renúncia abrange igualmente ações contra os atuais ou futuros sócios, gerentes, administradores, trabalhadores ou representantes legais da Sociedade."],
    ["CLÁUSULA SEXTA", "(Boa fé e inexistência de reservas)", "As Renunciantes declaram que celebram o presente acordo de forma livre, informada e de boa-fé, sem reservas mentais, não existindo qualquer acordo paralelo, verbal ou escrito, que contrarie o aqui estipulado."],
    ["CLÁUSULA SÉTIMA", "(Autonomia e subsistência)", "1. O presente acordo é juridicamente autónomo e independente de quaisquer outros contratos celebrados entre as Partes.\n2. A sua validade e eficácia não dependem da validade, execução ou eventual resolução de contratos de cessão de quotas ou de quaisquer outros instrumentos."],
    ["CLÁUSULA OITAVA", "(Foro)", "Para a resolução de quaisquer litígios emergentes do presente acordo, é competente o foro da comarca de Lisboa, com expressa renúncia a qualquer outro."],
  ];
  cl.forEach(([t, s, texto]) => { clausula(t, s).forEach(x => c.push(x)); texto.split("\n").forEach(pp => c.push(p(pp))); });

  c.push(p(`Feito num único exemplar, ficando o mesmo na posse da Sociedade, em ${contexto.local || "Lisboa"} a ${contexto.data || "[DATA]"}.`, { before: 400 }));
  [...renunciantes, ...socios].forEach(r => {
    c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    c.push(p("______________________________"));
    c.push(p(`(${r.nome || r.firma})`));
  });

  await savIt(buildDoc(c), `Renuncia_Creditos_Laborais_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

// ── CESSÃO E EXTINÇÃO DE SUPRIMENTOS ───────────────────────────────────
export async function generateCessaoSuprimentos(soc, identidades, contexto) {
  const renunciantes = (contexto.renunciantes || []).map(sid => identidades[sid]).filter(Boolean);
  const socios = (contexto.sociosAtuais || []).map(sid => identidades[sid]).filter(Boolean);

  const c = [];
  c.push(p("ACORDO DE CESSÃO, RENÚNCIA E EXTINÇÃO DEFINITIVA DO DIREITO AOS CRÉDITOS DE SUPRIMENTOS", { center: true, bold: true, after: 300 }));
  c.push(p(`"${soc.firma}"`, { center: true, bold: true, after: 400 }));
  c.push(p("ENTIDADE:", { bold: true }));
  c.push(p(`"${soc.firma}", ${soc.tipo.toLowerCase()}, com sede em ${soc.sede}, pessoa coletiva número ${soc.nipc}, com o capital social de ${fmt(soc.capital)}.`));
  c.push(p("ENTRE:", { bold: true, before: 200 }));
  [...renunciantes, ...socios].forEach(r => c.push(p(`${formatarIdentificacao(r)};`, { before: 120 })));

  c.push(p("Considerando que:", { bold: true, before: 300 }));
  c.push(p("I. As Renunciantes foram sócias da Sociedade até à data da cessão das respetivas quotas, tendo participado no seu financiamento;"));
  c.push(p("II. No âmbito dessa participação, as Renunciantes efetuaram entradas financeiras na Sociedade, suscetíveis de qualificação jurídica como suprimentos;"));
  c.push(p("III. É intenção expressa, livre e consciente das Partes extinguir de forma definitiva, total e irrevogável todos os créditos de suprimentos detidos pelas Renunciantes."));

  const cl = [
    ["CLÁUSULA PRIMEIRA", "(Objeto)", "O presente acordo tem por objeto a cessão de todos os créditos de suprimentos que as Renunciantes detenham ou possam deter sobre a Sociedade, independentemente da sua origem, montante, data de constituição ou qualificação contabilística."],
    ["CLÁUSULA SEGUNDA", "(Reconhecimento e identificação dos créditos)", "1. As Renunciantes declaram ser, ou ter sido, titulares de créditos sobre a Sociedade resultantes de entradas financeiras efetuadas.\n2. As Partes reconhecem que os referidos créditos poderão constar da contabilidade da Sociedade, sem que a sua identificação individualizada constitua condição de validade do presente acordo."],
    ["CLÁUSULA TERCEIRA", "(Cessão e renúncia definitiva)", `1. As Renunciantes cedem à Sociedade, que expressamente aceita, a totalidade dos créditos de suprimentos existentes.\n2. ${contexto.valorContemplado ? "O valor da cessão está contemplado no valor pago através do contrato de cessão de quotas." : "A cessão é efetuada pelo valor global a identificar pelas Partes."}\n3. As Renunciantes renunciam expressa, irrevogável e definitivamente ao direito de exigir qualquer reembolso do capital, juros ou encargos.`],
    ["CLÁUSULA QUARTA", "(Extinção plena do direito aos suprimentos)", "1. Com a assinatura do presente acordo, os direitos das Renunciantes aos créditos de suprimentos consideram-se total e definitivamente extintos.\n2. A extinção abrange créditos vencidos, vincendos, condicionais, contingentes ou eventuais."],
    ["CLÁUSULA QUINTA", "(Garantias das Cedentes)", "1. As Renunciantes garantem que são as únicas e legítimas titulares dos direitos aos créditos ora extintos.\n2. Obrigam-se a indemnizar a Sociedade por quaisquer prejuízos resultantes da violação das garantias prestadas."],
    ["CLÁUSULA SEXTA", "(Renúncia ao exercício de ações)", "As Partes obrigam-se a não intentar, nem promover, direta ou indiretamente, qualquer ação judicial, arbitral, administrativa ou fiscal fundada nos créditos ora extintos."],
    ["CLÁUSULA SÉTIMA", "(Autonomia e subsistência)", "O presente acordo é juridicamente autónomo, mantendo-se plenamente válido independentemente da validade ou resolução de quaisquer outros contratos celebrados entre as Partes."],
    ["CLÁUSULA OITAVA", "(Foro)", "Para a resolução de quaisquer litígios emergentes do presente acordo, é competente o foro da comarca de Lisboa, com expressa renúncia a qualquer outro."],
  ];
  cl.forEach(([t, s, texto]) => { clausula(t, s).forEach(x => c.push(x)); texto.split("\n").forEach(pp => c.push(p(pp))); });

  c.push(p(`Feito num único exemplar, ficando o mesmo na posse da Sociedade, em ${contexto.local || "Lisboa"} a ${contexto.data || "[DATA]"}.`, { before: 400 }));
  [...renunciantes, ...socios].forEach(r => {
    c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    c.push(p("______________________________"));
    c.push(p(`(${r.nome || r.firma})`));
  });

  await savIt(buildDoc(c), `Cessao_Suprimentos_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

// ── ASSUNÇÃO INTERNA DE DÍVIDA (Conta Caucionada) ──────────────────────
export async function generateAssuncaoDivida(soc, identidades, contexto) {
  const exoneradas = (contexto.renunciantes || []).map(sid => identidades[sid]).filter(Boolean);
  const socios = (contexto.sociosAtuais || []).map(sid => identidades[sid]).filter(Boolean);

  const c = [];
  c.push(p("ACORDO DE ASSUNÇÃO INTERNA DE DÍVIDA, EXONERAÇÃO DE RESPONSABILIDADE (Conta Caucionada)", { center: true, bold: true, after: 300 }));
  c.push(p(`"${soc.firma}"`, { center: true, bold: true, after: 400 }));
  c.push(p("ENTIDADE:", { bold: true }));
  c.push(p(`"${soc.firma}", ${soc.tipo.toLowerCase()}, com sede em ${soc.sede}, pessoa coletiva número ${soc.nipc}, com o capital social de ${fmt(soc.capital)}.`));
  c.push(p("ENTRE:", { bold: true, before: 200 }));
  [...exoneradas, ...socios].forEach(r => c.push(p(`${formatarIdentificacao(r)};`, { before: 120 })));

  c.push(p("Considerando que:", { bold: true, before: 300 }));
  c.push(p("I. Existe uma conta caucionada titulada junto de instituição bancária, associada à atividade da Sociedade;"));
  c.push(p("II. No âmbito da constituição e utilização da referida conta caucionada, as Exoneradas prestaram garantias pessoais e assumiram responsabilidades acessórias;"));
  c.push(p("III. As Partes pretendem regular definitivamente a responsabilidade económica associada à dívida, transferindo-a integralmente para a Sociedade e exonerando as Exoneradas;"));
  c.push(p("IV. As Partes reconhecem que o presente acordo tem eficácia exclusivamente entre as Partes, não sendo oponível a quaisquer terceiros, designadamente a instituições bancárias."));

  const valorDivida = contexto.valorDivida || 0;
  const iban = contexto.iban || "[IBAN]";
  const banco = contexto.banco || "[BANCO]";

  const cl = [
    ["CLÁUSULA PRIMEIRA", "(Objeto)", "O presente acordo tem por objeto a assunção interna integral da dívida associada à conta caucionada pela Sociedade, bem como a exoneração total das Exoneradas e a fixação de uma obrigação de indemnização."],
    ["CLÁUSULA SEGUNDA", "(Identificação e âmbito da dívida)", `1. As Partes reconhecem a existência de uma conta caucionada associada à Sociedade, com saldo devedor à data da assinatura do presente acordo no valor de ${fmt(valorDivida)}, com o IBAN ${iban}, do ${banco}.\n2. O presente acordo abrange todos os valores atualmente em dívida ou que venham a ser exigidos no futuro, incluindo capital, juros, comissões, penalidades, despesas bancárias e quaisquer encargos acessórios.`],
    ["CLÁUSULA TERCEIRA", "(Assunção integral da responsabilidade económica)", "1. A Sociedade assume integral, exclusiva e definitiva responsabilidade económica pelo pagamento da dívida associada à conta caucionada.\n2. A Sociedade reconhece que a dívida constitui obrigação exclusivamente sua."],
    ["CLÁUSULA QUARTA", "(Exoneração interna das Exoneradas)", "As Exoneradas ficam totalmente exoneradas, de qualquer obrigação ou responsabilidade relacionada com a conta caucionada."],
    ["CLÁUSULA QUINTA", "(Obrigação de indemnização)", "1. Caso as Exoneradas venham, por qualquer motivo, a ser chamadas a responder pela dívida, total ou parcialmente, a Sociedade obriga-se a reembolsar integralmente os valores pagos, juros legais ou contratuais, custos, despesas, honorários e encargos associados.\n2. O reembolso deverá ocorrer no prazo máximo de 90 dias úteis após solicitação escrita."],
    ["CLÁUSULA SEXTA", "(Diligência junto da instituição bancária)", "A Sociedade compromete-se a diligenciar, de boa-fé, junto da instituição bancária, pela exoneração formal das Exoneradas, nomeadamente através da substituição de garantias ou renegociação contratual."],
    ["CLÁUSULA SÉTIMA", "(Autonomia e subsistência)", "O presente acordo é autónomo e produz efeitos entre as Partes independentemente da intervenção da instituição bancária."],
    ["CLÁUSULA OITAVA", "(Foro)", "Para a resolução de quaisquer litígios emergentes do presente acordo, é competente o foro da comarca de Lisboa, com expressa renúncia a qualquer outro."],
  ];
  cl.forEach(([t, s, texto]) => { clausula(t, s).forEach(x => c.push(x)); texto.split("\n").forEach(pp => c.push(p(pp))); });

  c.push(p(`Feito num único exemplar, ficando o mesmo na posse da Sociedade, em ${contexto.local || "Lisboa"} a ${contexto.data || "[DATA]"}.`, { before: 400 }));
  [...exoneradas, ...socios].forEach(r => {
    c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    c.push(p("______________________________"));
    c.push(p(`(${r.nome || r.firma})`));
  });

  await savIt(buildDoc(c), `Assuncao_Divida_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}
