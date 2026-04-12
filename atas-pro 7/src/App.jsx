import { useState, useEffect, useMemo, useCallback } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, TabStopType } from "docx";
import { saveAs } from "file-saver";
import { PassoIdentificacao, formatarIdentificacao, emptyPessoaSingular } from "./identidades.jsx";
import { generateBemProprio, generateRenunciaLaboral, generateCessaoSuprimentos, generateAssuncaoDivida } from "./documentos_extra.jsx";

// ═══════════════════════════════════════════════════════════════════════
// ATAS PRO v5 — NIPC Auto · Certificado · Download DOCX
// ═══════════════════════════════════════════════════════════════════════
// 1. Introduz NIPC → busca localStorage → se não existe, preenche dados públicos
// 2. Certificado de admissibilidade com exceções legais
// 3. Geração real de DOCX com download funcional
// ═══════════════════════════════════════════════════════════════════════

// ── LOCALSTORAGE SOCIETY STORE ──────────────────────────────────────────

const STORE_KEY = "atas_pro_sociedades";

function loadSociedades() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
}
function saveSociedade(soc) {
  const all = loadSociedades();
  const idx = all.findIndex(s => s.nipc === soc.nipc);
  if (idx >= 0) all[idx] = soc; else all.push(soc);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}
function findByNipc(nipc) {
  return loadSociedades().find(s => s.nipc === nipc.replace(/\s/g, ""));
}

// ── TEMPLATES ───────────────────────────────────────────────────────────

const T = {
  // Preâmbulo — padrão Ata nº 4 (ECLIPTIC) e Ata TAINAN
  preambulo: (soc, uni) => uni
    ? `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede}, a Assembleia Geral Extraordinária da sociedade unipessoal por quotas, denominada "${soc.firma}", com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}).`
    : `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede}, a Assembleia Geral Extraordinária da sociedade por quotas, denominada "${soc.firma}", com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}).`,

  // Identificação completa do sócio — padrão extraído dos documentos reais
  socio: (id) => `[NOME_SOCIO_${id}], [ESTADO_CIVIL_${id}], [NACIONALIDADE_${id}], natural de [NATURALIDADE_${id}], com o número de identificação fiscal [NIF_${id}], portador do [DOC_TIPO_${id}] n.º [DOC_NUM_${id}], emitido pela República Portuguesa e válido até [DOC_VALIDADE_${id}], residente em [MORADA_${id}]`,

  // Assembleia universal — padrão Ata nº 4 (Ecliptic)
  universal: (uni) => uni
    ? "Verificando-se estar reunida a totalidade do capital social e tendo sido dispensadas todas as formalidades prévias de convocação nos termos do artigo 54.º do Código das Sociedades Comerciais, [NOME_SOCIO_A] manifestou a sua vontade no sentido de que a assembleia se constituísse e deliberasse sobre a seguinte ordem de trabalhos:"
    : "Por estar representada a totalidade do capital social, foi manifestada a vontade de que a Assembleia Geral se constituísse e deliberasse com dispensa da observância das formalidades prévias, nos termos do art. 54.º do Código das Sociedades Comerciais, assumindo a presidência da assembleia o sócio-gerente [NOME_PRESIDENTE], com a seguinte ordem de trabalhos:",

  // Encerramento — padrão Ata nº 4
  encerramento: (uni) => uni
    ? "Nada mais havendo a tratar, foi encerrada a sessão pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelo sócio, em sinal de conformidade."
    : "Nada mais havendo a tratar, foi a sessão encerrada pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelas partes, em sinal de conformidade.",

  // Cessão de quotas — padrão Ata TAINAN e Ata 4IN
  delib_cessao: (soc, fd) => `Foi comunicado à sociedade, que ${fd.ces_data ? `no dia ${fd.ces_data}` : "[DATA]"}, foi realizado um contrato de cessão de quotas, tendo sido cedida a quota do sócio [NOME_CEDENTE], com o valor nominal de ${fd.ces_vn ? fmt(Number(fd.ces_vn)) : "[VALOR]"} (${fd.ces_vn ? extenso(Number(fd.ces_vn)) : "[VALOR_EXTENSO]"}), correspondente a ${fd.ces_percentagem || "[PERCENTAGEM]"}% do capital social, a [NOME_CESSIONARIO]. ${fd.ces_consentimento_exigido === "nao" ? "Em conformidade com o disposto no artigo 228.º n.º 2 do Código das Sociedades Comerciais, a referida cessão de quotas encontra-se dispensada de consentimento da sociedade, por se tratar de negócio celebrado entre sócios." : "Foi deliberado e concedido por unanimidade o consentimento da sociedade à referida cessão, nos termos do artigo 228.º do Código das Sociedades Comerciais."}`,

  // Modificação de unipessoal em plural — padrão Ata TAINAN
  delib_modificacao_unipessoal: (soc) => `Foi deliberada a modificação da sociedade unipessoal por quotas em sociedade comercial por quotas, ao abrigo da pluralidade de sócios, ex vi legis artigo 270.º-D do Código das Sociedades Comerciais. Assim, passa a firma da sociedade a ser designada como "[NOVA_FIRMA_SEM_UNIPESSOAL]".`,

  delib_aumento: (soc, fd) => {
    const m = Number(fd.aum_montante) || 0;
    const nc = (soc.capital || 0) + m;
    return `Foi apresentado um conjunto de considerações sobre a necessidade de serem reforçados os capitais próprios da sociedade, através de um aumento de capital na modalidade de novas entradas em numerário. O reforço no montante de ${fmt(m)} (${extenso(m)}) eleva o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}) para ${fmt(nc)} (${extenso(nc)}). ${fd.aum_realizacao_integral === "sim" ? "Declara-se, nos termos e para os efeitos do artigo 88.º do Código das Sociedades Comerciais, que a entrada em numerário já foi realizada, encontrando-se o respetivo valor depositado nos cofres da Sociedade, não sendo exigida pela lei ou pelos estatutos a realização de outras entradas." : "As entradas serão realizadas no prazo de [PRAZO_REALIZACAO]."}`;
  },

  // Alterações com "código de acesso" — padrão Ata nº 4 (ECLIPTIC)
  delib_alteracao_firma: (soc, fd) => `${fd.cert_codigo ? `Iniciada a assembleia e após apresentação do certificado de admissibilidade com o código de acesso ${fd.cert_codigo}, foi deliberado` : fd.cert_dispensado ? `Foi deliberado` : `Após apresentação do certificado de admissibilidade com o código de acesso [CODIGO_ACESSO], foi deliberado`} proceder à alteração da firma da sociedade, que passa a ser: "${fd.novo_texto || "[NOVA_FIRMA]"}".${fd.cert_dispensado ? ` A alteração de firma não necessita de certificado de admissibilidade, ${fd.cert_motivo_dispensa || "por a alteração decorrente de transformação se restringir à alteração do elemento que identifica o tipo de pessoa coletiva — art. 54.º, n.º 3 do Regime Jurídico do Registo Nacional de Pessoas Coletivas"}.` : ``}`,

  delib_alteracao_sede: (soc, fd) => `${fd.cert_codigo ? `Iniciada a assembleia e após apresentação do certificado de admissibilidade com o código de acesso ${fd.cert_codigo}, foi deliberado` : fd.cert_dispensado ? `Foi deliberado` : `Após apresentação do certificado de admissibilidade com o código de acesso [CODIGO_ACESSO], foi deliberado`} proceder à alteração da sede da sociedade para: "${fd.novo_texto || "[NOVA_SEDE]"}".${fd.cert_dispensado ? ` A alteração de sede não necessita de certificado de admissibilidade, ${fd.cert_motivo_dispensa || "por a firma ser constituída por expressão de fantasia — art. 54.º, n.º 3 do Regime Jurídico do Registo Nacional de Pessoas Coletivas"}.` : ``}`,

  delib_alteracao_objeto: (soc, fd) => `${fd.cert_codigo ? `Iniciada a assembleia e após apresentação do certificado de admissibilidade com o código de acesso ${fd.cert_codigo}, foi deliberado` : fd.cert_dispensado ? `Foi deliberado` : `Após apresentação do certificado de admissibilidade com o código de acesso [CODIGO_ACESSO], foi deliberado`} proceder à alteração do objeto social da sociedade passando a constar: "${fd.novo_texto || "[NOVO_OBJETO]"}".${fd.cert_dispensado ? ` Não é necessário certificado de admissibilidade, ${fd.cert_motivo_dispensa || ""}.` : ``}`,

  delib_nomeacao_gerente: () => `Foi proposto e aprovado por unanimidade a nomeação de [NOME_GERENTE_NOVO], [ESTADO_CIVIL_GERENTE], NIF [NIF_GERENTE_NOVO], residente em [MORADA_GERENTE_NOVO], para o cargo de gerente da sociedade. O nomeado declara aceitar o cargo para que foi eleito e encontra-se em plenas condições para o exercício das funções, não se verificando qualquer situação de incompatibilidade ou impedimento.`,

  delib_destituicao: (fd) => `Foi deliberado a destituição de [NOME_GERENTE_DESTITUIDO] do cargo de gerente da sociedade${fd.dest_justa_causa === "sim" ? ", com justa causa, com fundamento em [FUNDAMENTO_JUSTA_CAUSA]" : ". A destituição opera sem invocação de justa causa, ficando ressalvado o direito a eventual indemnização nos termos legais"}.`,

  delib_dissolucao: (fd) => `Foi deliberado, por unanimidade, a dissolução da sociedade, ao abrigo do artigo 141.º, n.º 1, alínea b) do Código das Sociedades Comerciais${fd.dis_fund ? `, com o seguinte fundamento: ${fd.dis_fund}` : ""}. A firma da sociedade passa a incluir a menção "em liquidação", nos termos legais.`,

  delib_contas: (fd) => `Foi apresentado e posto à discussão o balanço, a demonstração de resultados e demais documentos de prestação de contas referentes ao exercício de ${fd.ct_exercicio || "[ANO]"}, tendo sido deliberado ${fd.ct_decisao === "aprovadas" ? "aprovar" : "não aprovar"} as contas do exercício, que apresentam um resultado líquido de ${fd.ct_resultado ? fmt(Number(fd.ct_resultado)) : "[VALOR]"}.`,

  delib_lucros: (fd) => `Foi deliberado proceder à distribuição de resultados do exercício no montante de ${fd.dl_total ? fmt(Number(fd.dl_total)) : "[VALOR]"} (${fd.dl_total ? extenso(Number(fd.dl_total)) : "[VALOR_EXTENSO]"}), na proporção das respetivas participações sociais.`,
};

// ── DOCX GENERATION ─────────────────────────────────────────────────────

async function generateAtaDocx(soc, selDel, fdMap) {
  const uni = soc.socios.length === 1;
  const pontos = ["Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito"];
  const children = [];

  const p = (text, opts = {}) => new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 },
    indent: opts.indent ? { left: 720 } : undefined,
    children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold, ...(opts.run || {}) })],
  });

  // Título
  children.push(p(`ATA N.º [NÚMERO]`, { center: true, bold: true, after: 400 }));

  // Preâmbulo
  children.push(p(T.preambulo(soc, uni)));

  // Presentes
  children.push(p(uni ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:", { before: 200 }));
  soc.socios.forEach((s, i) => {
    children.push(p(`${String.fromCharCode(97 + i)}) ${T.socio(s.id)}, titular de uma quota no valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`, { indent: true }));
  });

  // Universal
  children.push(p(T.universal(uni), { before: 200 }));

  // Ordem do dia
  selDel.forEach((did, i) => {
    children.push(p(`Ponto ${pontos[i] || i + 1}: ${getOrdemDia(did, fdMap[did] || {})}`, { bold: true }));
  });

  // Deliberações
  selDel.forEach((did, i) => {
    const fd = fdMap[did] || {};
    children.push(p(`Entrou-se ${i === 0 ? "de imediato" : "seguidamente"} na discussão do Ponto ${pontos[i] || i + 1} da Ordem de Trabalhos.`, { before: 300, bold: true }));
    children.push(p(getDelibText(did, soc, fd)));
  });

  // Encerramento
  children.push(p(T.encerramento(uni), { before: 400 }));

  // Assinaturas
  soc.socios.forEach(s => {
    children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
    children.push(p("______________________________"));
    children.push(p(`[NOME_SOCIO_${s.id}]`));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Ata_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

async function generateListaSociosDocx(soc) {
  const children = [];
  const p = (text, opts = {}) => new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.after || 200, line: 360 },
    indent: opts.indent ? { left: 720 } : undefined,
    children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold })],
  });

  children.push(p("LISTA DE SÓCIOS", { center: true, bold: true, after: 400 }));
  children.push(p(`${soc.firma}, ${soc.tipo.toLowerCase()}, com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com sede em ${soc.sede}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), representado pela${soc.socios.length > 1 ? "s seguintes quotas" : " seguinte quota"}:`));

  soc.socios.forEach((s, i) => {
    children.push(p(`${String.fromCharCode(97 + i)}) Uma quota com o valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), representativa de ${s.pct}% da totalidade do capital social, pertencente a ${T.socio(s.id)}.`, { indent: true }));
  });

  children.push(p("[LOCAL], [DATA]", { before: 400 }));
  children.push(p(soc.socios.length > 1 ? "Os Sócios," : "O Sócio,", { before: 200 }));
  soc.socios.forEach(s => {
    children.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
    children.push(p("______________________________"));
    children.push(p(`[NOME_SOCIO_${s.id}]`));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Lista_Socios_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

// Acordo Parassocial — baseado no modelo Vilas Boas (19 cláusulas)
async function generateParassocialDocx(soc, fdMap) {
  const children = [];
  const p = (text, opts = {}) => new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 },
    indent: opts.indent ? { left: 720 } : undefined,
    children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold })],
  });
  const title = (text) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: true })],
  });

  children.push(p("ACORDO PARASSOCIAL", { center: true, bold: true, after: 400 }));
  children.push(p("ENTIDADE:", { bold: true, before: 200 }));
  children.push(p(`${soc.firma}, ${soc.tipo.toLowerCase()}, com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com sede em ${soc.sede}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), que tem por objeto "${soc.objeto || "[OBJETO_SOCIAL]"}", adiante apenas "Sociedade".`));

  children.push(p("ENTRE:", { bold: true, before: 300 }));
  soc.socios.forEach((s, i) => {
    const ord = ["Primeiro", "Segunda", "Terceiro", "Quarta", "Quinto", "Sexta"][i] || `${i + 1}.º`;
    children.push(p(`${T.socio(s.id)}, titular de uma quota com o valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), adiante designado por "${ord} Outorgante";`, { before: 120 }));
    if (i < soc.socios.length - 1) children.push(p("E", { bold: true, center: true }));
  });

  children.push(p("Sendo os Outorgantes designados, conjuntamente, por \"Partes\" ou \"Outorgantes\" e qualquer uma delas, indistintamente, por \"Parte\" ou \"Outorgante\".", { before: 200 }));

  children.push(p("Considerando que:", { bold: true, before: 300 }));
  children.push(p("a) Os Outorgantes são sócios da Sociedade;"));
  children.push(p("b) As Partes representam a totalidade do capital social;"));
  children.push(p("c) As Partes pretendem regular, por via do presente Acordo Parassocial, os termos e condições para a gerência da sociedade;"));
  children.push(p("d) As Partes reconhecem que o presente Acordo é celebrado em complemento do contrato de sociedade, vinculando os Outorgantes na qualidade de sócios da Sociedade, nos termos do artigo 17.º do Código das Sociedades Comerciais."));

  children.push(p("Os Outorgantes, livremente e de boa-fé, celebram e reciprocamente aceitam o presente Acordo Parassocial, do qual fazem parte os considerandos supra e que se rege pelos termos e condições constantes das Cláusulas seguintes:", { before: 200 }));

  // Cláusulas
  const clausulas = [
    { t: "CLÁUSULA PRIMEIRA", s: "(OBJETIVO)", c: "O presente Acordo Parassocial tem por objeto regular, exclusivamente entre as Partes e nos termos do artigo 17.º do Código das Sociedades Comerciais, regras complementares à lei e ao contrato de sociedade, relativas à organização e funcionamento da relação societária, designadamente no que respeita à governação da sociedade, aos deveres de informação e transparência, à definição de matérias sujeitas a consenso reforçado, bem como à proteção dos interesses societários e patrimoniais das Partes." },
    { t: "CLÁUSULA SEGUNDA", s: "(PODERES DE GERÊNCIA)", c: `1. O Gerente dispõe de autonomia plena para a condução da atividade diária da sociedade, incluindo a organização operacional, a gestão de recursos humanos, a relação com clientes e fornecedores e a execução dos contratos celebrados pela sociedade.\n\n2. Carecem de consentimento prévio, expresso e escrito de todos os sócios, nomeadamente com assinatura de todos os sócios, sem prejuízo das exigências legais ou estatutárias aplicáveis, os seguintes atos:\n\na) Investimentos de qualquer matéria superior a ${fdMap?.parassocial?.limite_investimento ? fmt(Number(fdMap.parassocial.limite_investimento)) : "€15.000,00 (Quinze mil euros)"};\nb) Contratos de serviços ou fornecedores superiores a ${fdMap?.parassocial?.limite_contratos ? fmt(Number(fdMap.parassocial.limite_contratos)) : "€85.000,00 (Oitenta e cinco mil euros)"};\nc) Qualquer financiamento, junto de instituições financeiras ou de investidores privados;\nd) Alterações ao pacto social;\ne) Qualquer alteração nas contas bancárias;\nf) Entrada ou saída de sócios, cessão ou oneração de quotas;\ng) Fixação ou alteração da remuneração de sócios ou gerentes;\nh) Dissolução, fusão, cisão ou transformação da sociedade;\ni) Alterações relevantes à política de reservas, reinvestimentos ou estrutura financeira.` },
    { t: "CLÁUSULA TERCEIRA", s: "(GESTÃO DE PESSOAS)", c: "1. Compete ao Gerente propor a contratação, cessação, avaliação, formação, organização e disciplina dos trabalhadores afetos à sociedade, seja por contrato de trabalho ou prestação de serviços, bem como assegurar o cumprimento das normas laborais, de segurança e saúde no trabalho.\n\n2. O exercício do poder disciplinar formal permanece na esfera da Sociedade.\n\n3. Qualquer conflito laboral imputável a falha de gestão constitui incumprimento grave.\n\n4. O gerente assume o risco e responsabilidade pela prevenção, gestão e resolução de situações de assédio, conflitos laborais, acidentes de trabalho e quaisquer ocorrências humanas." },
    { t: "CLÁUSULA QUARTA", s: "(LICENÇAS E AUTORIZAÇÕES)", c: "1. Compete ao Gerente assegurar a existência, obtenção, renovação atempada e manutenção em vigor de todas as licenças, autorizações, registos e títulos legalmente exigidos para o regular funcionamento da sociedade.\n\n2. O Gerente é responsável por garantir o cumprimento das obrigações legais perante, designadamente, a ASAE, ACT, Câmara Municipal, Autoridade Tributária, Segurança Social, Autoridade de Saúde e demais entidades públicas.\n\n3. O Gerente deve garantir a existência, validade e atualização dos seguros legalmente obrigatórios." },
    { t: "CLÁUSULA QUINTA", s: "(RESPONSABILIDADES DO GERENTE)", c: "1. O gerente é responsável pela entrega atempada de toda a documentação, informação e elementos necessários ao cumprimento das obrigações fiscais, contributivas e declarativas da sociedade.\n\n2. O gerente assume a responsabilidade por coimas, contraordenações e sanções administrativas decorrentes de atos ou omissões no âmbito da exploração da Sociedade.\n\n3. Em caso de condenação, pagamento de coima, indemnização ou prejuízo patrimonial sofrido pela Sociedade em virtude de ato ou omissão do Gerente, a Sociedade goza de direito de regresso." },
    { t: "CLÁUSULA SEXTA", s: "(CONFIDENCIALIDADE E PROTEÇÃO DO KNOW-HOW)", c: "1. O gerente obriga-se a guardar absoluto sigilo sobre todos os dados, receitas, processos, métodos, listas de clientes, fornecedores, estratégias comerciais e demais informação confidencial da sociedade, não podendo, durante a vigência do contrato e nos dois anos subsequentes à sua cessação, utilizar ou divulgar tal informação, sob pena de responsabilidade civil e disciplinar." },
    { t: "CLÁUSULA SÉTIMA", s: "(IMAGEM DA SOCIEDADE)", c: "1. O gerente compromete-se a zelar pela reputação, imagem e bom nome da Sociedade, abstendo-se de condutas ou declarações públicas suscetíveis de causar dano reputacional." },
    { t: "CLÁUSULA OITAVA", s: "(OBRIGAÇÕES DO GERENTE PERANTE A SOCIEDADE)", c: "1. É obrigação do Gerente disponibilizar aos restantes sócios, de forma atualizada e com periodicidade mensal, as contas e relatórios financeiros simplificados.\n\n2. O Gerente obriga-se a comunicar por escrito aos sócios qualquer incidente relevante no prazo máximo de 5 dias úteis.\n\n3. Fica desde já estipulada a realização de reunião mensal obrigatória entre os sócios." },
    { t: "CLÁUSULA NONA", s: "(ALTERAÇÕES SOCIETÁRIAS)", c: "1. Qualquer aumento de capital social, transformação ou modificação da sociedade, cessão de quota, amortização ou qualquer alteração societária, deve ficar refletida em ata que deve ser assinada por todos os sócios da sociedade." },
    { t: "CLÁUSULA DÉCIMA", s: "(REMUNERAÇÃO DO GERENTE)", c: "1. A remuneração do gerente deve ser formalmente aprovada, declarada e integralmente refletida na contabilidade da sociedade.\n\n2. Ficam expressamente afastados pagamentos informais, adiantamentos encapotados, ajudas de custo não justificadas ou quaisquer mecanismos remuneratórios não contabilizados.\n\n3. Qualquer aumento ou alteração remuneratória futura deve ser previamente comunicada aos sócios e devidamente justificada por escrito." },
    { t: "CLÁUSULA DÉCIMA-PRIMEIRA", s: "(DIREITO DE PREFERÊNCIA)", c: "1. Em caso de transmissão de quotas, os restantes sócios gozam de direito de preferência na aquisição, nos termos a definir pelas Partes.\n\n2. O exercício do direito de preferência não confere a qualquer sócio o direito de obrigar os demais à alienação das respetivas quotas." },
    { t: "CLÁUSULA DÉCIMA-SEGUNDA", s: "(NÃO CONCORRÊNCIA)", c: "1. O Gerente obriga-se a não exercer, direta ou indiretamente, qualquer atividade que constitua concorrência com a Sociedade, designadamente através do exercício de cargos de administração, gerência ou direção, ou da detenção de participações sociais, em sociedades que prossigam objeto social idêntico ou substancialmente semelhante.\n\n2. O disposto no número anterior não se aplica quando exista consentimento prévio, expresso e escrito dos restantes sócios." },
    { t: "CLÁUSULA DÉCIMA-TERCEIRA", s: "(CESSAÇÃO E SOBREVIVÊNCIA DAS OBRIGAÇÕES)", c: "A cessação do presente acordo, por qualquer causa, não prejudica a subsistência das obrigações de confidencialidade, não concorrência, indemnização e direito de regresso, que se mantêm pelo prazo legal ou contratualmente estipulado." },
    { t: "CLÁUSULA DÉCIMA-QUARTA", s: "(RESOLUÇÃO)", c: "1. O presente Acordo Parassocial pode ser resolvido a todo o tempo por mútuo consentimento das Partes.\n\n2. Em caso de incumprimento grave ou reiterado das obrigações assumidas por qualquer das Partes, assiste à Parte não faltosa o direito de resolver o Acordo, mediante comunicação escrita fundamentada.\n\n3. A resolução do presente Acordo não prejudica o exercício de quaisquer direitos que assistam às Partes, designadamente o direito de regresso e responsabilidade civil." },
    { t: "CLÁUSULA DÉCIMA-QUINTA", s: "(COMUNICAÇÕES)", c: "1. Quaisquer notificações ou comunicações a que haja lugar nos termos deste Acordo considerar-se-ão devidamente efetuadas quando enviadas por correio registado para os endereços dos sócios ou para os e-mails convencionados.\n\n2. Consideram-se efetuadas 3 (três) dias úteis após ter sido remetida pelo correio ou no dia útil imediatamente seguinte à transmissão do e-mail." },
    { t: "CLÁUSULA DÉCIMA-SEXTA", s: "(INVALIDADE)", c: "1. A invalidade total ou parcial de qualquer Cláusula do presente Acordo não afetará a validade das restantes disposições.\n\n2. As Partes comprometem-se a usar os seus melhores esforços para acordar uma solução que remedeie ou mitigue os efeitos da referida invalidade." },
    { t: "CLÁUSULA DÉCIMA-SÉTIMA", s: "(CONFIDENCIALIDADE)", c: "1. As Partes obrigam-se reciprocamente a manter absoluto sigilo e rigorosa confidencialidade sobre a celebração e sobre o conteúdo do presente Acordo.\n\n2. Cessa a obrigação de sigilo quando haja autorização escrita das Partes, quando a informação seja exigida por lei ou quando necessário para execução do presente Acordo." },
    { t: "CLÁUSULA DÉCIMA-OITAVA", s: "(LEI E FORO COMPETENTE)", c: "1. O presente Acordo rege-se pela lei portuguesa.\n\n2. Todos os litígios emergentes deste Acordo ou com ele relacionados será exclusivamente competente o Tribunal Judicial da Comarca de [COMARCA], com expressa renúncia a qualquer outro." },
  ];

  clausulas.forEach(cl => {
    children.push(title(cl.t));
    children.push(p(cl.s, { center: true, bold: true }));
    cl.c.split("\n\n").forEach(para => children.push(p(para)));
  });

  children.push(p("Feito num único exemplar, com valor de original, ficando na posse da Sociedade, em [LOCAL], a [DATA_EXTENSO].", { before: 400 }));

  soc.socios.forEach((s, i) => {
    const ord = ["Primeiro", "Segunda", "Terceiro", "Quarta"][i] || `${i + 1}.º`;
    children.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
    children.push(p(`O ${ord} Outorgante`));
    children.push(p("______________________________"));
    children.push(p(`[NOME_SOCIO_${s.id}]`));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Acordo_Parassocial_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

// ── UTILITIES ───────────────────────────────────────────────────────────

const fmt = v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
const fmtD = d => new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });

function extenso(v) {
  const n = Number(v); if (!n) return "zero euros";
  const u = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove"];
  const t2 = ["dez","onze","doze","treze","catorze","quinze","dezasseis","dezassete","dezoito","dezanove"];
  const t = ["","dez","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const h = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  function w(n) {
    if (n===0) return ""; if (n===100) return "cem"; if (n<10) return u[n]; if (n<20) return t2[n-10];
    if (n<100) { const d=t[Math.floor(n/10)],r=n%10; return r?`${d} e ${u[r]}`:d; }
    if (n<1000) { const c=h[Math.floor(n/100)],r=n%100; return r?`${n===100?"cem":c} e ${w(r)}`:(n===100?"cem":c); }
    if (n<1000000) { const th=Math.floor(n/1000),r=n%1000; const tw=th===1?"mil":`${w(th)} mil`; return r?(r<100?`${tw} e ${w(r)}`:`${tw} ${w(r)}`):tw; }
    return String(n);
  }
  const cents = Math.round((n%1)*100);
  let r = w(Math.floor(n)) + " euros";
  if (cents > 0) r += ` e ${w(cents)} cêntimos`;
  return r;
}

function getOrdemDia(did, fd) {
  const m = {
    aumento_capital:"Deliberar sobre o aumento do capital social.",
    cessao_quotas:"Informar sobre a cessão de quotas.",
    alteracao_firma:"Deliberar sobre a alteração da firma.",
    alteracao_sede:"Deliberar sobre a alteração da sede.",
    alteracao_objeto:"Deliberar sobre a alteração do objeto social.",
    alteracao_forma_obrigar:"Deliberar sobre a alteração da forma de obrigar.",
    aprovacao_contas:`Deliberar sobre a aprovação das contas do exercício de ${fd.ct_exercicio||"[ANO]"}.`,
    distribuicao_lucros:"Deliberar sobre a distribuição de lucros.",
    dissolucao:"Deliberar sobre a dissolução da sociedade.",
    nomeacao_gerente:"Deliberar sobre a nomeação de gerente.",
    destituicao_gerente:"Deliberar sobre a destituição de gerente.",
  };
  return m[did] || `Deliberar sobre ${DELIB_TYPES.find(d=>d.id===did)?.label||"[deliberação]"}.`;
}

function getDelibText(did, soc, fd) {
  if (did==="cessao_quotas") return T.delib_cessao(soc, fd);
  if (did==="aumento_capital") return T.delib_aumento(soc, fd);
  if (did==="alteracao_firma") return T.delib_alteracao_firma(soc, fd);
  if (did==="alteracao_sede") return T.delib_alteracao_sede(soc, fd);
  if (did==="alteracao_objeto") return T.delib_alteracao_objeto(soc, fd);
  if (did==="nomeacao_gerente") return T.delib_nomeacao_gerente();
  if (did==="destituicao_gerente") return T.delib_destituicao(fd);
  if (did==="dissolucao") return T.delib_dissolucao(fd);
  if (did==="aprovacao_contas") return T.delib_contas(fd);
  if (did==="distribuicao_lucros") return T.delib_lucros(fd);
  return `[TEXTO DA DELIBERAÇÃO — ${DELIB_TYPES.find(d=>d.id===did)?.label}]`;
}

// ── CONFIG ──────────────────────────────────────────────────────────────

const DELIB_TYPES = [
  {id:"aumento_capital",label:"Aumento de Capital",icon:"↑",cat:"capital",pacto:true,lista:true,registo:true,rcbe:true,maioria:true},
  {id:"suprimentos",label:"Suprimentos",icon:"§",cat:"capital",pacto:false,lista:false,registo:false,rcbe:false},
  {id:"prestacoes_suplementares",label:"Prestações Suplementares",icon:"±",cat:"capital",pacto:"cond",lista:false,registo:"cond",rcbe:false},
  {id:"cessao_quotas",label:"Cessão de Quotas",icon:"⇄",cat:"quotas",pacto:false,lista:true,registo:true,rcbe:true},
  {id:"amortizacao",label:"Amortização de Quotas",icon:"✕",cat:"quotas",pacto:"cond",lista:true,registo:true,rcbe:true},
  {id:"exclusao_exoneracao",label:"Exclusão / Exoneração",icon:"⊘",cat:"socios",pacto:false,lista:true,registo:true,rcbe:true},
  {id:"alteracao_firma",label:"Alteração de Firma",icon:"A",cat:"pacto",pacto:true,lista:false,registo:true,rcbe:false,maioria:true,certAdm:true},
  {id:"alteracao_sede",label:"Alteração de Sede",icon:"⌂",cat:"pacto",pacto:true,lista:false,registo:true,rcbe:false,maioria:true,certAdm:true},
  {id:"alteracao_objeto",label:"Alteração de Objeto",icon:"◈",cat:"pacto",pacto:true,lista:false,registo:true,rcbe:false,maioria:true,certAdm:true},
  {id:"alteracao_forma_obrigar",label:"Forma de Obrigar",icon:"⊡",cat:"pacto",pacto:true,lista:false,registo:true,rcbe:false,maioria:true},
  {id:"aprovacao_contas",label:"Aprovação de Contas",icon:"✓",cat:"contas",pacto:false,lista:false,registo:false,rcbe:false},
  {id:"distribuicao_lucros",label:"Distribuição de Lucros",icon:"€",cat:"contas",pacto:false,lista:false,registo:false,rcbe:false},
  {id:"dissolucao",label:"Dissolução",icon:"⊗",cat:"vida",pacto:true,lista:false,registo:true,rcbe:false,maioria:true},
  {id:"nomeacao_gerente",label:"Nomeação de Gerente",icon:"⊞",cat:"gerencia",pacto:false,lista:false,registo:true,rcbe:false},
  {id:"destituicao_gerente",label:"Destituição de Gerente",icon:"⊟",cat:"gerencia",pacto:false,lista:false,registo:true,rcbe:false},
  {id:"acordo_parassocial",label:"Acordo Parassocial",icon:"⊜",cat:"socios",pacto:false,lista:false,registo:false,rcbe:false},
  {id:"unificacao_quotas",label:"Unificação de Quotas",icon:"⊕",cat:"quotas",pacto:"cond",lista:true,registo:true,rcbe:true},
  {id:"divisao_quotas",label:"Divisão de Quotas",icon:"⊟",cat:"quotas",pacto:"cond",lista:true,registo:true,rcbe:true},
  {id:"modificacao_uni_pluri",label:"Modificação Unipessoal → Pluripessoal",icon:"⇌",cat:"vida",pacto:true,lista:true,registo:true,rcbe:true,maioria:true},
  {id:"outra",label:"Outra Deliberação",icon:"…",cat:"outros",pacto:false,lista:false,registo:false,rcbe:false},
];

const CATS = {capital:"Estrutura de Capital",quotas:"Quotas",socios:"Sócios",pacto:"Pacto Social",contas:"Contas e Resultados",vida:"Vida da Sociedade",gerencia:"Gerência",outros:"Outros"};

const AUM_SUBS = [
  {id:"dinheiro_socios",l:"Entradas em dinheiro — só sócios"},
  {id:"dinheiro_novos",l:"Entradas em dinheiro — com novos sócios"},
  {id:"dinheiro_renuncia",l:"Renúncia ao direito de preferência"},
  {id:"reservas",l:"Incorporação de reservas"},
  {id:"conversao_assembleia",l:"Conversão de suprimentos — assembleia"},
  {id:"especie",l:"Entradas em espécie"},
];

const CESSAO_SUBS = [
  {id:"socios_familia",l:"Entre sócios ou família"},
  {id:"terceiro_consentimento",l:"A terceiro com consentimento"},
  {id:"recusa_amortizacao",l:"Recusa com amortização"},
  {id:"recusa_aquisicao",l:"Recusa com aquisição"},
];

const CERT_DISPENSAS = [
  {id:"tipo_pc",l:"Alteração restrita ao tipo de pessoa coletiva (ex: Lda → Unipessoal Lda) — art. 54.º, n.º 3 RJRNPC"},
  {id:"fantasia",l:"Firma constituída por expressão de fantasia — art. 54.º, n.º 3 RJRNPC"},
  {id:"sede_fantasia",l:"Alteração de sede com firma de fantasia — art. 54.º, n.º 3 RJRNPC"},
  {id:"outro",l:"Outro motivo de dispensa"},
];

// ── VALIDATION ──────────────────────────────────────────────────────────

function validate(did, fd, soc) {
  const B=[],W=[],I=[];
  if (!soc) return {B,W,I};
  const dt=DELIB_TYPES.find(d=>d.id===did);
  if (dt?.maioria) {
    const req=soc.maioriaContratual||75, v=Number(fd.votosAFavor)||0;
    if (v>0&&v<req) B.push(`Maioria insuficiente: ${v}% < ${req}% exigido (art. 265.º CSC).`);
  }
  if (did==="aumento_capital") {
    if (fd.aum_anterior_pendente==="sim") B.push("Aumento anterior não registado — bloqueado (art. 87.º, n.º 3 CSC).");
    if (fd.aum_prestacoes_falta==="sim") B.push("Prestações vencidas em falta — bloqueado (art. 87.º, n.º 4 CSC).");
    if (fd.aum_sub==="dinheiro_renuncia") W.push("Renúncia ao direito de preferência — art. 266.º CSC.");
    if (fd.aum_sub==="reservas"&&fd.aum_contas_6meses==="nao"&&fd.aum_balanco_especial!=="sim") B.push("Contas >6 meses sem balanço especial — bloqueado (art. 91.º, n.º 2 CSC).");
    if (fd.aum_sub?.startsWith("conversao")&&fd.aum_declaracao_cc!=="sim") B.push("Falta declaração CC/ROC — bloqueado.");
    I.push("Art. 87.º CSC: deliberação deve conter modalidade, montante e prazos.");
  }
  if (did==="cessao_quotas") {
    if (fd.ces_consentimento_exigido==="sim"&&fd.ces_consentimento_dado!=="sim") B.push("Consentimento exigido mas não concedido (art. 228.º CSC).");
    if (fd.ces_tipo==="parcial") W.push("Cessão parcial exige consentimento para divisão (art. 221.º CSC).");
    const s=soc.socios.find(x=>x.id===fd.ces_socio);
    if (s?.penhor) W.push("Quota com penhor — notificar credor pignoratício.");
    I.push("Art. 228.º CSC: forma escrita obrigatória.");
  }
  if (did==="exclusao_exoneracao") {
    if (fd.excl_sub==="exclusao"&&fd.excl_contraditorio!=="sim") W.push("Exclusão sem contraditório — altamente litigioso.");
    if (!fd.excl_destino_quota) B.push("Destino da quota não definido — bloqueado.");
  }
  if (dt?.certAdm && !fd.cert_dispensado && !fd.cert_codigo) W.push("Indicar código de acesso do certificado de admissibilidade ou marcar dispensa.");
  if (did==="dissolucao") I.push("Firma passará a conter 'em liquidação'.");
  return {B,W,I};
}

function computeEffects(selDel, fdMap) {
  const fx={pacto:false,lista:false,registo:false,rcbe:false}; const docs=new Set(["Ata"]);
  selDel.forEach(did=>{
    const dt=DELIB_TYPES.find(d=>d.id===did); if(!dt)return; const fd=fdMap[did]||{};
    if(dt.pacto===true)fx.pacto=true;
    if(dt.pacto==="cond"&&((did==="prestacoes_suplementares"&&fd.ps_sub==="criacao")||(did==="amortizacao"&&fd.amort_sub==="com_reducao")))fx.pacto=true;
    if(dt.lista===true)fx.lista=true;
    if(dt.registo===true)fx.registo=true;
    if(dt.rcbe===true)fx.rcbe=true;
    if(fx.pacto)docs.add("Pacto Social Atualizado");
    if(fx.lista){docs.add("Lista de Sócios");docs.add("Mapa de Quotas");}
    if(fx.rcbe)docs.add("Atualização RCBE");
    if(fx.registo)docs.add("Requerimento de Registo");
    if(did==="aumento_capital"){docs.add("Declaração de Entradas");docs.add("Declaração CC/ROC");}
    if(did==="cessao_quotas"){docs.add("Contrato de Cessão"); if(fd.gerar_parassocial==="sim")docs.add("Acordo Parassocial"); if(fd.gerar_bem_proprio==="sim")docs.add("Declaração de Bem Próprio"); if(fd.gerar_renuncia_laboral==="sim")docs.add("Renúncia a Créditos Laborais"); if(fd.gerar_cessao_suprimentos==="sim")docs.add("Cessão e Extinção de Suprimentos"); if(fd.gerar_assuncao_divida==="sim")docs.add("Assunção Interna de Dívida");}
    if(did==="nomeacao_gerente")docs.add("Aceitação de Gerente");
    if(did==="suprimentos")docs.add("Contrato de Suprimento");
    if(did==="aprovacao_contas")docs.add("Depósito de Contas");
    if(did==="distribuicao_lucros")docs.add("Recibos de Dividendos");
  });
  return {fx,docs:Array.from(docs)};
}

// ── UI PRIMITIVES ───────────────────────────────────────────────────────

const CL={d:"#0F172A",g:"#B8976A",gr:"#6B7280",gn:"#059669",r:"#DC2626",bl:"#2563EB",am:"#D97706"};

function Badge({t,type}){const m={pacto:{bg:"#FEF3C7",c:"#92400E",i:"◆"},lista:{bg:"#DBEAFE",c:"#1E40AF",i:"☰"},registo:{bg:"#FCE7F3",c:"#9D174D",i:"⬡"},rcbe:{bg:"#F3E8FF",c:"#6B21A8",i:"◎"},block:{bg:"#FEE2E2",c:"#991B1B",i:"⛔"},warn:{bg:"#FFFBEB",c:"#92400E",i:"⚠"},info:{bg:"#EFF6FF",c:"#1E40AF",i:"ℹ"},legal:{bg:"#FDF8F0",c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",c:"#166534",i:"🔒"}}[type]||{bg:"#F3F4F6",c:"#374151",i:"•"};return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,background:m.bg,color:m.c}}>{m.i} {t}</span>;}

function Cd({children,style,onClick,hover}){const[h,sH]=useState(false);return<div onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:24,transition:"all 0.2s",cursor:onClick?"pointer":"default",...(hover&&h?{borderColor:CL.g,boxShadow:"0 4px 12px rgba(184,151,106,0.12)"}:{}),...style}}>{children}</div>;}

function Inp({label,value,onChange,placeholder,type="text",required,disabled,eph,style:sx}){return<div style={{display:"flex",flexDirection:"column",gap:6,...sx}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}{eph&&<span style={{fontSize:9,color:CL.gn,fontWeight:600,background:"#ECFDF5",padding:"1px 6px",borderRadius:3,marginLeft:6}}>placeholder</span>}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{padding:"10px 14px",border:`1px solid ${eph?"#A7F3D0":"#D1D5DB"}`,borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#1F2937",background:disabled?"#F9FAFB":eph?"#F0FDF9":"#fff",outline:"none"}} onFocus={e=>e.target.style.borderColor=CL.g} onBlur={e=>e.target.style.borderColor=eph?"#A7F3D0":"#D1D5DB"}/></div>;}

function Sel({label,value,onChange,options,required,placeholder}){return<div style={{display:"flex",flexDirection:"column",gap:6}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{padding:"10px 14px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:value?"#1F2937":"#9CA3AF",background:"#fff",outline:"none",cursor:"pointer"}}><option value="">{placeholder||"Selecionar..."}</option>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select></div>;}

function Rad({label,value,onChange,options,required}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}</label>}<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{options.map(o=><div key={o.v} onClick={()=>onChange(o.v)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:6,cursor:"pointer",border:value===o.v?`2px solid ${CL.d}`:"1px solid #D1D5DB",background:value===o.v?"#F0F4FF":"#fff",fontSize:13,fontWeight:value===o.v?600:400}}><div style={{width:16,height:16,borderRadius:"50%",border:value===o.v?"none":"2px solid #D1D5DB",background:value===o.v?CL.d:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{value===o.v&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}</div>{o.l}</div>)}</div></div>;}

function Btn({children,onClick,v="primary",size="md",disabled,style:sx}){const s={primary:{bg:CL.d,c:"#fff",b:"none"},secondary:{bg:"#fff",c:CL.d,b:"1px solid #D1D5DB"},accent:{bg:CL.g,c:"#fff",b:"none"},ghost:{bg:"transparent",c:CL.gr,b:"none"}}[v];return<button onClick={onClick} disabled={disabled} style={{padding:size==="sm"?"8px 16px":size==="lg"?"14px 28px":"10px 20px",borderRadius:6,fontSize:size==="sm"?12:size==="lg"?15:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:8,background:disabled?"#E5E7EB":s.bg,color:disabled?"#9CA3AF":s.c,border:s.b||"none",opacity:disabled?0.7:1,...sx}}>{children}</button>;}

function Al({type,title,children}){const m={info:{bg:"#EFF6FF",b:"#3B82F6",c:"#1E40AF",i:"ℹ"},warning:{bg:"#FFFBEB",b:"#F59E0B",c:"#92400E",i:"⚠"},block:{bg:"#FEE2E2",b:"#EF4444",c:"#991B1B",i:"⛔"},legal:{bg:"#FDF8F0",b:CL.g,c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",b:CL.gn,c:"#166534",i:"🔒"},success:{bg:"#F0FDF4",b:"#22C55E",c:"#166534",i:"✓"}}[type];return<div style={{display:"flex",gap:14,padding:16,borderRadius:8,background:m.bg,borderLeft:`3px solid ${m.b}`}}><span style={{fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>{m.i}</span><div>{title&&<div style={{fontSize:13,fontWeight:600,color:m.c,marginBottom:4}}>{title}</div>}<div style={{fontSize:13,color:m.c,lineHeight:1.5}}>{children}</div></div></div>;}

function Steps({steps,cur}){return<div style={{display:"flex",alignItems:"center",padding:"0 0 32px"}}>{steps.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:i<=cur?CL.d:"#E5E7EB",color:i<=cur?"#fff":"#9CA3AF"}}>{i<cur?"✓":i+1}</div><span style={{fontSize:13,fontWeight:i===cur?600:400,color:i<=cur?CL.d:"#9CA3AF",whiteSpace:"nowrap"}}>{s}</span></div>{i<steps.length-1&&<div style={{flex:1,height:2,margin:"0 16px",background:i<cur?CL.d:"#E5E7EB"}}/>}</div>)}</div>;}

function DocText({text}){if(!text)return null;const parts=text.split(/(\[[A-Z_]+(?:_[A-Z0-9]+)*\])/g);return<>{parts.map((p,i)=>p.startsWith("[")&&p.endsWith("]")?<span key={i} style={{background:"#FEF3C7",color:"#92400E",padding:"1px 4px",borderRadius:3,fontWeight:600,fontSize:"0.95em",fontFamily:"monospace"}}>{p}</span>:<span key={i}>{p}</span>)}</>;}

// ── SIDEBAR ─────────────────────────────────────────────────────────────

function Sidebar({active,setActive}){
  const nav=[{id:"dashboard",l:"Dashboard",i:"⊞"},{id:"wizard",l:"Nova Deliberação",i:"+"},{id:"sociedades",l:"Sociedades",i:"◈"}];
  return<div style={{width:260,minHeight:"100vh",background:CL.d,display:"flex",flexDirection:"column",flexShrink:0}}>
    <div style={{padding:"28px 24px 24px",borderBottom:"1px solid #1E293B"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${CL.g},#D4B88C)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:CL.d}}>§</div><div><div style={{fontSize:17,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.02em",fontFamily:"'Playfair Display',serif"}}>ATAS PRO</div><div style={{fontSize:10,color:"#64748B",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:500}}>v5</div></div></div></div>
    <nav style={{padding:"16px 12px",flex:1}}>{nav.map(n=><button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:active===n.id?600:400,fontFamily:"'DM Sans',sans-serif",marginBottom:4,background:active===n.id?"#1E293B":"transparent",color:active===n.id?"#F1F5F9":"#94A3B8"}}><span style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:active===n.id?CL.g+"22":"transparent",color:active===n.id?CL.g:"#64748B"}}>{n.i}</span>{n.l}</button>)}</nav>
    <div style={{padding:"16px 24px 24px",borderTop:"1px solid #1E293B"}}><div style={{fontSize:10,color:CL.gn,fontWeight:500}}>🔒 Zero dados pessoais no servidor</div></div>
  </div>;
}

// ── NIPC INPUT COMPONENT ────────────────────────────────────────────────

function NipcInput({ onSociedadeReady }) {
  const [nipc, setNipc] = useState("");
  const [soc, setSoc] = useState(null);
  const [mode, setMode] = useState("search"); // search | found | create
  const [form, setForm] = useState({ firma:"", sede:"", tipo:"Sociedade por Quotas", capital:"", objeto:"", formaObrigar:"", numGerentes:"1", numSocios:"2", maioriaContratual:"" });

  const search = () => {
    const clean = nipc.replace(/[\s.]/g, "");
    if (clean.length < 9) return;
    const found = findByNipc(clean);
    if (found) { setSoc(found); setMode("found"); onSociedadeReady(found); }
    else { setMode("create"); setForm(f => ({ ...f, nipc: clean })); }
  };

  const create = () => {
    const numS = Number(form.numSocios) || 2;
    const cap = Number(form.capital) || 0;
    const quotaPadrao = cap > 0 ? Math.floor(cap / numS) : 0;
    const socios = Array.from({ length: numS }, (_, i) => ({
      id: String.fromCharCode(65 + i), quota: i === 0 ? cap - quotaPadrao * (numS - 1) : quotaPadrao,
      pct: i === 0 ? Math.round((cap - quotaPadrao * (numS - 1)) / cap * 100) : Math.round(quotaPadrao / cap * 100),
      penhor: false, usufruto: false,
    }));
    const newSoc = {
      nipc: form.nipc || nipc.replace(/[\s.]/g, ""), firma: form.firma, sede: form.sede, tipo: form.tipo,
      capital: cap, objeto: form.objeto, formaObrigar: form.formaObrigar || "A sociedade obriga-se com a intervenção de um gerente.",
      numGerentes: Number(form.numGerentes) || 1, socios, maioriaContratual: Number(form.maioriaContratual) || null,
    };
    saveSociedade(newSoc);
    setSoc(newSoc);
    setMode("found");
    onSociedadeReady(newSoc);
  };

  return <Cd>
    <h3 style={{ fontSize: 16, fontWeight: 600, color: CL.d, margin: "0 0 20px" }}>Identificação da Sociedade</h3>

    {/* NIPC Input */}
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
      <Inp label="NIPC" value={nipc} onChange={setNipc} placeholder="Ex: 516234567" required style={{ flex: 1 }} />
      <Btn onClick={search} disabled={nipc.replace(/[\s.]/g, "").length < 9}>Procurar</Btn>
    </div>

    {/* Found */}
    {mode === "found" && soc && <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 20, border: "1px solid #BBF7D0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: CL.d }}>{soc.firma}</div>
        <Badge t="Dados carregados" type="privacy" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13 }}>
        {[["NIPC", soc.nipc], ["Capital", fmt(soc.capital)], ["Tipo", soc.tipo]].map(([l, v], i) => <div key={i}><div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 4 }}>{l}</div><div style={{ fontWeight: 600 }}>{v}</div></div>)}
      </div>
      <div style={{ marginTop: 12, fontSize: 13 }}><span style={{ color: CL.gr }}>Sede: </span>{soc.sede}</div>
      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 6 }}>Sócios (anónimos)</div>
      {soc.socios.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}><span style={{ fontWeight: 600 }}>Sócio {s.id}</span><span>{fmt(s.quota)} ({s.pct}%){s.penhor ? " · penhor" : ""}</span></div>)}
    </div>}

    {/* Create */}
    {mode === "create" && <div>
      <Al type="info" title="Sociedade não encontrada">Preencha os dados públicos da sociedade. Ficam guardados para utilização futura.</Al>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Inp label="Firma" value={form.firma} onChange={v => setForm(f => ({ ...f, firma: v }))} required placeholder="Ex: Empresa, Lda." />
        <Sel label="Tipo" value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))} options={[{ v: "Sociedade por Quotas", l: "Sociedade por Quotas" }, { v: "Sociedade Unipessoal por Quotas", l: "Soc. Unipessoal por Quotas" }]} />
        <Inp label="Sede" value={form.sede} onChange={v => setForm(f => ({ ...f, sede: v }))} required placeholder="Morada completa" style={{ gridColumn: "1/-1" }} />
        <Inp label="Capital Social (€)" value={form.capital} onChange={v => setForm(f => ({ ...f, capital: v }))} type="number" required placeholder="Ex: 50000" />
        <Inp label="N.º Sócios" value={form.numSocios} onChange={v => setForm(f => ({ ...f, numSocios: v }))} type="number" required placeholder="2" />
        <Inp label="Objeto Social" value={form.objeto} onChange={v => setForm(f => ({ ...f, objeto: v }))} placeholder="Atividade principal" style={{ gridColumn: "1/-1" }} />
        <Inp label="Forma de Obrigar" value={form.formaObrigar} onChange={v => setForm(f => ({ ...f, formaObrigar: v }))} placeholder="A sociedade obriga-se com..." style={{ gridColumn: "1/-1" }} />
        <Inp label="N.º Gerentes" value={form.numGerentes} onChange={v => setForm(f => ({ ...f, numGerentes: v }))} type="number" placeholder="1" />
        <Inp label="Maioria contratual (% — se >75%)" value={form.maioriaContratual} onChange={v => setForm(f => ({ ...f, maioriaContratual: v }))} type="number" placeholder="75 (default)" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><Btn v="accent" onClick={create} disabled={!form.firma || !form.capital}>Guardar Sociedade e Continuar</Btn></div>
    </div>}
  </Cd>;
}

// ── CERTIFICADO DE ADMISSIBILIDADE COMPONENT ────────────────────────────

function CertAdmissibilidade({ fd, upd }) {
  return <div style={{ background: "#FFFBEB", borderRadius: 8, padding: 16, border: "1px solid #FDE68A", marginTop: 8 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 12 }}>Certificado de Admissibilidade</div>
    <Rad label="Necessita de certificado?" value={fd.cert_dispensado ? "nao" : "sim"} onChange={v => upd("cert_dispensado", v === "nao")} options={[{ v: "sim", l: "Sim — indicar código de acesso" }, { v: "nao", l: "Dispensado" }]} required />
    {!fd.cert_dispensado && <div style={{ marginTop: 12 }}>
      <Inp label="Código de Acesso do Certificado de Admissibilidade" value={fd.cert_codigo} onChange={v => upd("cert_codigo", v)} required placeholder="Ex: 1475-1647-4386" />
      <div style={{ fontSize: 11, color: "#92400E", marginTop: 4 }}>Indicar o código de acesso fornecido pelo RNPC (formato XXXX-XXXX-XXXX).</div>
    </div>}
    {fd.cert_dispensado && <div style={{ marginTop: 12 }}>
      <Sel label="Motivo de dispensa" value={fd.cert_motivo_dispensa_id} onChange={v => { upd("cert_motivo_dispensa_id", v); upd("cert_motivo_dispensa", CERT_DISPENSAS.find(c => c.id === v)?.l || ""); }} options={CERT_DISPENSAS.map(c => ({ v: c.id, l: c.l }))} required placeholder="Selecionar motivo..." />
    </div>}
  </div>;
}

// ── WIZARD ──────────────────────────────────────────────────────────────

function Wizard({ onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [soc, setSoc] = useState(null);
  const [identidades, setIdentidades] = useState({}); // {socioId: identidade} — SÓ EM MEMÓRIA
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [downloading, setDownloading] = useState(false);

  const stNames = ["Sociedade", "Identificação", "Deliberações", "Formulários", "Documentos", "Download"];
  const getFd = did => fdMap[did] || {};
  const upd = (did, k, v) => setFdMap(p => ({ ...p, [did]: { ...(p[did] || {}), [k]: v } }));
  const togDel = id => setSelDel(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);
  const updIdentidade = (socioId, novo) => setIdentidades(p => ({ ...p, [socioId]: novo }));

  // Limpar identidades quando a sociedade muda
  useEffect(() => { if (soc && Object.keys(identidades).length === 0) { const init = {}; soc.socios.forEach(s => { init[s.id] = emptyPessoaSingular(); }); setIdentidades(init); } }, [soc]);

  const allVal = useMemo(() => { const r = {}; selDel.forEach(did => { r[did] = validate(did, getFd(did), soc); }); return r; }, [selDel, fdMap, soc]);
  const hasBlock = useMemo(() => Object.values(allVal).some(v => v.B.length > 0), [allVal]);
  const { fx, docs } = useMemo(() => computeEffects(selDel, fdMap), [selDel, fdMap]);

  const handleDownload = async (docName) => {
    setDownloading(true);
    try {
      const cesFd = fdMap.cessao_quotas || {};
      const aumFd = fdMap.aumento_capital || {};
      const contextoSaida = {
        local: "Lisboa",
        data: new Date().toLocaleDateString("pt-PT"),
        renunciantes: cesFd.ces_socio ? [cesFd.ces_socio] : [],
        sociosAtuais: soc ? soc.socios.map(s => s.id).filter(sid => sid !== cesFd.ces_socio) : [],
      };

      if (docName === "Ata") await generateAtaDocx(soc, selDel, fdMap);
      else if (docName === "Lista de Sócios") await generateListaSociosDocx(soc);
      else if (docName === "Acordo Parassocial") {
        await generateParassocialDocx(soc, { parassocial: { limite_investimento: cesFd.parassocial_limite_investimento, limite_contratos: cesFd.parassocial_limite_contratos } });
      }
      else if (docName === "Declaração de Bem Próprio") {
        const socioId = cesFd.ces_socio || (aumFd.aum_socio_unilateral);
        await generateBemProprio(soc, identidades, { socioId, valor: cesFd.ces_vn || aumFd.aum_montante, local: "Lisboa", data: new Date().toLocaleDateString("pt-PT") });
      }
      else if (docName === "Renúncia a Créditos Laborais") await generateRenunciaLaboral(soc, identidades, contextoSaida);
      else if (docName === "Cessão e Extinção de Suprimentos") await generateCessaoSuprimentos(soc, identidades, { ...contextoSaida, valorContemplado: true });
      else if (docName === "Assunção Interna de Dívida") await generateAssuncaoDivida(soc, identidades, { ...contextoSaida, valorDivida: Number(cesFd.divida_valor) || 0, iban: cesFd.divida_iban, banco: cesFd.divida_banco });
      else alert(`Geração de "${docName}" — em desenvolvimento.`);
    } catch (e) { console.error(e); alert("Erro ao gerar documento: " + e.message); }
    setDownloading(false);
  };

  const renderForm = (did) => {
    const fd = getFd(did); const u = (k, v) => upd(did, k, v); const v = allVal[did] || { B: [], W: [], I: [] };
    const dt = DELIB_TYPES.find(d => d.id === did);

    return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {v.B.map((b, i) => <Al key={`b${i}`} type="block" title="BLOQUEANTE">{b}</Al>)}
      {v.W.map((w, i) => <Al key={`w${i}`} type="warning" title="Alerta">{w}</Al>)}
      {v.I.map((n, i) => <Al key={`i${i}`} type="legal">{n}</Al>)}

      {did === "aumento_capital" && <>
        <Sel label="Modalidade" value={fd.aum_sub} onChange={v => u("aum_sub", v)} options={AUM_SUBS.map(s => ({ v: s.id, l: s.l }))} required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Inp label="Capital Atual" value={fmt(soc?.capital)} disabled /><Inp label="Montante" value={fd.aum_montante} onChange={v => u("aum_montante", v)} type="number" required placeholder="€" /><Inp label="Novo Capital" value={fd.aum_montante ? fmt((soc?.capital || 0) + Number(fd.aum_montante)) : ""} disabled />
        </div>
        <Rad label="Aumento anterior pendente?" value={fd.aum_anterior_pendente} onChange={v => u("aum_anterior_pendente", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />
        <Rad label="Prestações vencidas em falta?" value={fd.aum_prestacoes_falta} onChange={v => u("aum_prestacoes_falta", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />
        <Rad label="Entradas realizadas integralmente?" value={fd.aum_realizacao_integral} onChange={v => u("aum_realizacao_integral", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} />
        {fd.aum_sub === "reservas" && <Rad label="Contas <6 meses?" value={fd.aum_contas_6meses} onChange={v => u("aum_contas_6meses", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} />}
        {fd.aum_sub?.startsWith("conversao") && <Rad label="Declaração CC/ROC?" value={fd.aum_declaracao_cc} onChange={v => u("aum_declaracao_cc", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />}
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}

      {did === "cessao_quotas" && <>
        <Sel label="Subtipo" value={fd.ces_sub} onChange={v => u("ces_sub", v)} options={CESSAO_SUBS.map(s => ({ v: s.id, l: s.l }))} required />
        <Sel label="Sócio Cedente" value={fd.ces_socio} onChange={v => u("ces_socio", v)} options={soc?.socios.map(s => ({ v: s.id, l: `Sócio ${s.id} — ${fmt(s.quota)} (${s.pct}%)` })) || []} required />
        <Rad label="Cessão total/parcial?" value={fd.ces_tipo} onChange={v => u("ces_tipo", v)} options={[{ v: "total", l: "Total" }, { v: "parcial", l: "Parcial" }]} required />
        {fd.ces_tipo === "parcial" && <Inp label="Valor da parte cedida" value={fd.ces_vn} onChange={v => u("ces_vn", v)} type="number" placeholder="€" required />}
        <Inp label="Percentagem cedida (%)" value={fd.ces_percentagem} onChange={v => u("ces_percentagem", v)} type="number" placeholder="Ex: 5.5" />
        <Inp label="Data da cessão" value={fd.ces_data} onChange={v => u("ces_data", v)} placeholder="Ex: 12 de Fevereiro de 2026" />
        <Rad label="Consentimento exigido?" value={fd.ces_consentimento_exigido} onChange={v => u("ces_consentimento_exigido", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não (livre)" }]} required />
        {fd.ces_consentimento_exigido === "sim" && <Rad label="Consentimento dado?" value={fd.ces_consentimento_dado} onChange={v => u("ces_consentimento_dado", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Recusa" }]} required />}

        <div style={{ background: "#FDF8F0", borderRadius: 8, padding: 16, border: "1px solid #E9D8AB", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#78582A" }}>Documentos Complementares</div>
            <button onClick={() => { u("gerar_parassocial", "sim"); u("gerar_bem_proprio", "sim"); u("gerar_renuncia_laboral", "sim"); u("gerar_cessao_suprimentos", "sim"); u("gerar_assuncao_divida", "sim"); }} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#78582A", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Selecionar todos (pacote saída)</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={fd.gerar_parassocial === "sim"} onChange={e => u("gerar_parassocial", e.target.checked ? "sim" : "nao")} style={{ marginTop: 3 }} /><span><strong>Acordo Parassocial</strong> — governação, direitos de preferência, tag-along, drag-along, deadlock (art. 17.º CSC)</span></label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={fd.gerar_bem_proprio === "sim"} onChange={e => u("gerar_bem_proprio", e.target.checked ? "sim" : "nao")} style={{ marginTop: 3 }} /><span><strong>Declaração de Bem Próprio</strong> — quando cessionário é casado em comunhão (art. 1723.º al. c) CC)</span></label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={fd.gerar_renuncia_laboral === "sim"} onChange={e => u("gerar_renuncia_laboral", e.target.checked ? "sim" : "nao")} style={{ marginTop: 3 }} /><span><strong>Renúncia a Créditos Laborais</strong> — cedente que exerceu funções na sociedade</span></label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={fd.gerar_cessao_suprimentos === "sim"} onChange={e => u("gerar_cessao_suprimentos", e.target.checked ? "sim" : "nao")} style={{ marginTop: 3 }} /><span><strong>Cessão e Extinção de Suprimentos</strong> — cedente com suprimentos na sociedade</span></label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={fd.gerar_assuncao_divida === "sim"} onChange={e => u("gerar_assuncao_divida", e.target.checked ? "sim" : "nao")} style={{ marginTop: 3 }} /><span><strong>Assunção Interna de Dívida</strong> — conta caucionada ou garantias pessoais</span></label>
          </div>

          {fd.gerar_parassocial === "sim" && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Limite investimentos (€)" value={fd.parassocial_limite_investimento} onChange={v => u("parassocial_limite_investimento", v)} type="number" placeholder="50000" />
            <Inp label="Limite contratos (€)" value={fd.parassocial_limite_contratos} onChange={v => u("parassocial_limite_contratos", v)} type="number" placeholder="85000" />
          </div>}
          {fd.gerar_assuncao_divida === "sim" && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Inp label="Valor em dívida (€)" value={fd.divida_valor} onChange={v => u("divida_valor", v)} type="number" />
            <Inp label="IBAN" value={fd.divida_iban} onChange={v => u("divida_iban", v)} placeholder="PT50..." />
            <Inp label="Banco" value={fd.divida_banco} onChange={v => u("divida_banco", v)} placeholder="BCP, CGD..." />
          </div>}
        </div>
      </>}

      {/* Alterações com certificado de admissibilidade */}
      {["alteracao_firma", "alteracao_sede", "alteracao_objeto"].includes(did) && <>
        <Inp label="Texto atual" value={did === "alteracao_firma" ? soc?.firma : did === "alteracao_sede" ? soc?.sede : soc?.objeto} disabled />
        <Inp label="Novo texto" value={fd.novo_texto} onChange={v => u("novo_texto", v)} required placeholder="Novo texto" />
        <CertAdmissibilidade fd={fd} upd={(k, v) => u(k, v)} />
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}

      {did === "alteracao_forma_obrigar" && <>
        <Inp label="Forma atual" value={soc?.formaObrigar} disabled />
        <Inp label="Nova forma" value={fd.novo_texto} onChange={v => u("novo_texto", v)} required placeholder="A sociedade obriga-se com..." />
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}

      {did === "aprovacao_contas" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}><Inp label="Exercício" value={fd.ct_exercicio} onChange={v => u("ct_exercicio", v)} placeholder="2025" required /><Inp label="Resultado Líquido" value={fd.ct_resultado} onChange={v => u("ct_resultado", v)} type="number" placeholder="€" required /></div><Rad label="Decisão" value={fd.ct_decisao} onChange={v => u("ct_decisao", v)} options={[{ v: "aprovadas", l: "Aprovadas" }, { v: "nao", l: "Não aprovadas" }]} required /></>}

      {did === "distribuicao_lucros" && <><Inp label="Montante total" value={fd.dl_total} onChange={v => u("dl_total", v)} type="number" placeholder="€" required />{soc && fd.dl_total && <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 16, border: "1px solid #E2E8F0" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Distribuição proporcional</div>{soc.socios.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}><span>Sócio {s.id} ({s.pct}%)</span><span style={{ fontWeight: 600, color: CL.gn }}>{fmt(Number(fd.dl_total) * s.pct / 100)}</span></div>)}</div>}</>}

      {did === "nomeacao_gerente" && <><Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" placeholder="100" /><Al type="privacy">Dados do gerente em placeholders: [NOME_GERENTE_NOVO], [NIF_GERENTE_NOVO], [MORADA_GERENTE_NOVO].</Al></>}

      {did === "destituicao_gerente" && <><Sel label="Gerente" value={fd.dest_gerente} onChange={v => u("dest_gerente", v)} options={Array.from({ length: soc?.numGerentes || 0 }, (_, i) => ({ v: `G${i + 1}`, l: `Gerente ${i + 1}` }))} required /><Rad label="Justa causa?" value={fd.dest_justa_causa} onChange={v => u("dest_justa_causa", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} /><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" placeholder="100" /></>}

      {did === "dissolucao" && <><Inp label="Fundamento" value={fd.dis_fund} onChange={v => u("dis_fund", v)} required placeholder="Art. 141.º CSC" /><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required /></>}

      {did === "exclusao_exoneracao" && <><Rad label="Tipo" value={fd.excl_sub} onChange={v => u("excl_sub", v)} options={[{ v: "exclusao", l: "Exclusão" }, { v: "exoneracao", l: "Exoneração" }]} required /><Sel label="Sócio" value={fd.excl_socio} onChange={v => u("excl_socio", v)} options={soc?.socios.map(s => ({ v: s.id, l: `Sócio ${s.id}` })) || []} required />{fd.excl_sub === "exclusao" && <Rad label="Contraditório?" value={fd.excl_contraditorio} onChange={v => u("excl_contraditorio", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />}<Sel label="Destino da quota" value={fd.excl_destino_quota} onChange={v => u("excl_destino_quota", v)} options={[{ v: "amortizacao", l: "Amortização" }, { v: "aquisicao_socios", l: "Aquisição por sócios" }]} required /></>}

      {!["aumento_capital","cessao_quotas","alteracao_firma","alteracao_sede","alteracao_objeto","alteracao_forma_obrigar","aprovacao_contas","distribuicao_lucros","nomeacao_gerente","destituicao_gerente","dissolucao","exclusao_exoneracao"].includes(did) && <><div><label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Descrição</label><textarea value={fd.desc||""} onChange={e=>u("desc",e.target.value)} rows={4} style={{width:"100%",padding:"10px 14px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",resize:"vertical",outline:"none",boxSizing:"border-box"}} placeholder="Termos da deliberação..."/></div><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v=>u("votosAFavor",v)} type="number" placeholder="100"/></>}
    </div>;
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}><div><h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Nova Deliberação</h1><p style={{ fontSize: 14, color: CL.gr, margin: "4px 0 0" }}>Introduza o NIPC e avance</p></div><Btn v="ghost" onClick={onCancel}>✕</Btn></div>
    <Steps steps={stNames} cur={step} />

    {/* STEP 0 — NIPC */}
    {step === 0 && <div><NipcInput onSociedadeReady={(s) => { setSoc(s); setIdentidades({}); }} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}><Btn disabled={!soc} onClick={() => setStep(1)}>Continuar →</Btn></div></div>}

    {/* STEP 1 — Identificação das Partes (SÓ EM MEMÓRIA) */}
    {step === 1 && <div>
      <PassoIdentificacao soc={soc} identidades={identidades} onUpdateIdentidade={updIdentidade} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <Btn v="secondary" onClick={() => setStep(0)}>← Voltar</Btn>
        <Btn onClick={() => setStep(2)}>Continuar →</Btn>
      </div>
    </div>}

    {/* STEP 2 — Deliberações */}
    {step === 2 && <div>
      <Cd style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16, fontWeight: 600, color: CL.d, margin: "0 0 20px" }}>Deliberações</h3>
        {Object.entries(CATS).map(([cid, cl]) => { const items = DELIB_TYPES.filter(d => d.cat === cid); return <div key={cid} style={{ marginBottom: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>{cl}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{items.map(d => { const sel = selDel.includes(d.id); return <div key={d.id} onClick={() => togDel(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer", border: sel ? `2px solid ${CL.d}` : "1px solid #E5E7EB", background: sel ? "#F0F4FF" : "#fff" }}><div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? "none" : "2px solid #D1D5DB", background: sel ? CL.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{sel ? "✓" : ""}</div><div><div style={{ fontSize: 13, fontWeight: sel ? 600 : 500 }}><span style={{ marginRight: 6, opacity: 0.5 }}>{d.icon}</span>{d.label}</div><div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{d.pacto && <Badge t="Pacto" type="pacto" />}{d.lista && <Badge t="Lista" type="lista" />}{d.registo && <Badge t="Registo" type="registo" />}{d.rcbe && <Badge t="RCBE" type="rcbe" />}{d.certAdm && <Badge t="Cert. Adm." type="warn" />}</div></div></div> })}</div></div> })}
      </Cd>
      {selDel.length > 0 && <Cd style={{ background: "#FAFBFD", marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{selDel.length} deliberação(ões) · {soc?.firma}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>{fx.pacto && <Badge t="Pacto Social" type="pacto" />}{fx.lista && <Badge t="Lista Sócios" type="lista" />}{fx.registo && <Badge t="Registo" type="registo" />}{fx.rcbe && <Badge t="RCBE" type="rcbe" />}</div><div style={{ fontSize: 12, color: CL.gr }}>Docs: {docs.join(" · ")}</div></Cd>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(1)}>← Voltar</Btn><Btn disabled={selDel.length === 0} onClick={() => setStep(3)}>Continuar →</Btn></div>
    </div>}

    {/* STEP 3 — Formulários */}
    {step === 3 && <div>
      {fx.rcbe && <div style={{ marginBottom: 12 }}><Al type="warning" title="RCBE">Atualização obrigatória em 30 dias (art. 14.º Lei 89/2017).</Al></div>}
      {selDel.map(did => { const dt = DELIB_TYPES.find(d => d.id === did); return <Cd key={did} style={{ marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: CL.d, display: "flex", alignItems: "center", justifyContent: "center", color: CL.g, fontSize: 14, fontWeight: 700 }}>{dt.icon}</div><h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{dt.label}</h3></div>{renderForm(did)}</Cd> })}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(2)}>← Voltar</Btn><Btn disabled={hasBlock} onClick={() => setStep(4)}>{hasBlock ? "Bloqueios ⛔" : "Documentos →"}</Btn></div>
    </div>}

    {/* STEP 4 — Preview */}
    {step === 4 && soc && <div>
      <Cd style={{ padding: 40, marginBottom: 24 }}>
        <div style={{ fontFamily: "'Times New Roman',serif", fontSize: 13, lineHeight: 2, maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}><h2 style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>ATA N.º [NÚMERO]</h2></div>
          <p><DocText text={T.preambulo(soc, soc.socios.length === 1)} /></p>
          <p style={{ marginTop: 16 }}><DocText text={soc.socios.length === 1 ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:"} /></p>
          {soc.socios.map((s, i) => <p key={i} style={{ paddingLeft: 20 }}><DocText text={`${String.fromCharCode(97 + i)}) ${identidades[s.id] && identidades[s.id].nome ? formatarIdentificacao(identidades[s.id]) : T.socio(s.id)}, titular de uma quota de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`} /></p>)}
          <p style={{ marginTop: 16 }}><DocText text={T.universal(soc.socios.length === 1)} /></p>
          {selDel.map((did, i) => <p key={did} style={{ fontWeight: 600 }}>Ponto {["Um", "Dois", "Três", "Quatro", "Cinco"][i] || i + 1}: <DocText text={getOrdemDia(did, getFd(did))} /></p>)}
          {selDel.map((did, i) => <div key={did} style={{ marginTop: 24 }}><p><DocText text={getDelibText(did, soc, getFd(did))} /></p></div>)}
          <p style={{ marginTop: 32 }}><DocText text={T.encerramento(soc.socios.length === 1)} /></p>
          {soc.socios.map((s, i) => <div key={i} style={{ marginTop: 32 }}><div style={{ borderTop: "1px solid #374151", width: 250, marginBottom: 4 }} /><DocText text={identidades[s.id]?.nome || `[NOME_SOCIO_${s.id}]`} /></div>)}
        </div>
      </Cd>
      <div style={{ display: "flex", justifyContent: "space-between" }}><Btn v="secondary" onClick={() => setStep(3)}>← Voltar</Btn><Btn v="accent" onClick={() => setStep(5)}>Download →</Btn></div>
    </div>}

    {/* STEP 5 — Download */}
    {step === 5 && <Cd style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", border: "2px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✓</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Documentos Prontos</h2>
      <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 6px" }}>{soc?.firma}</p>
      <p style={{ fontSize: 12, color: CL.gn, margin: "0 0 32px" }}>🔒 Dados pessoais integrados da sessão atual</p>
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "left" }}>{docs.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 8, marginBottom: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>📄</span><span style={{ fontSize: 13, fontWeight: 500 }}>{d}</span></div><Btn v="accent" size="sm" onClick={() => handleDownload(d)} disabled={downloading}>{downloading ? "..." : "DOCX ↓"}</Btn></div>)}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}><Btn v="secondary" onClick={() => setStep(4)}>← Rever</Btn><Btn v="accent" onClick={onDone}>Concluir</Btn></div>
    </Cd>}
  </div>;
}

// ── EDIT SOCIEDADE MODAL ────────────────────────────────────────────────

function EditSociedadeModal({ sociedade, onClose, onSave }) {
  const [form, setForm] = useState({
    ...sociedade,
    socios: sociedade.socios || [],
  });

  const updField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updSocio = (i, k, v) => setForm(f => ({ ...f, socios: f.socios.map((s, j) => j === i ? { ...s, [k]: v } : s) }));
  const addSocio = () => {
    const nextId = String.fromCharCode(65 + form.socios.length);
    setForm(f => ({ ...f, socios: [...f.socios, { id: nextId, quota: 0, pct: 0, penhor: false, usufruto: false }] }));
  };
  const removeSocio = (i) => setForm(f => ({ ...f, socios: f.socios.filter((_, j) => j !== i) }));

  // Recalcular percentagens automaticamente
  const recalcPcts = () => {
    const total = form.socios.reduce((sum, s) => sum + Number(s.quota || 0), 0);
    if (total === 0) return;
    setForm(f => ({
      ...f,
      capital: total,
      socios: f.socios.map(s => ({ ...s, pct: Math.round((Number(s.quota || 0) / total) * 10000) / 100 })),
    }));
  };

  const handleSave = () => {
    const cleaned = {
      ...form,
      capital: Number(form.capital) || 0,
      numGerentes: Number(form.numGerentes) || 1,
      maioriaContratual: form.maioriaContratual ? Number(form.maioriaContratual) : null,
      socios: form.socios.map(s => ({ ...s, quota: Number(s.quota) || 0, pct: Number(s.pct) || 0 })),
    };
    saveSociedade(cleaned);
    onSave(cleaned);
    onClose();
  };

  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }} onClick={onClose}>
    <div style={{ background: "#fff", borderRadius: 12, maxWidth: 800, width: "100%", padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Editar Sociedade</h2>
          <p style={{ fontSize: 13, color: CL.gr, margin: "4px 0 0" }}>Apenas dados públicos do registo comercial</p>
        </div>
        <Btn v="ghost" onClick={onClose}>✕</Btn>
      </div>

      <Al type="privacy" title="Lembrete de privacidade">Os placeholders ([NOME_SOCIO_A], [NIF_A], etc.) nunca são preenchidos aqui. Os dados pessoais são preenchidos apenas no documento Word final.</Al>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #E5E7EB" }}>Dados da Sociedade</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Inp label="NIPC" value={form.nipc} onChange={v => updField("nipc", v)} disabled />
          <Sel label="Tipo" value={form.tipo} onChange={v => updField("tipo", v)} options={[{ v: "Sociedade por Quotas", l: "Sociedade por Quotas" }, { v: "Sociedade Unipessoal por Quotas", l: "Soc. Unipessoal por Quotas" }]} />
          <Inp label="Firma" value={form.firma} onChange={v => updField("firma", v)} required style={{ gridColumn: "1/-1" }} />
          <Inp label="Sede" value={form.sede} onChange={v => updField("sede", v)} required style={{ gridColumn: "1/-1" }} />
          <Inp label="Capital Social (€)" value={form.capital} onChange={v => updField("capital", v)} type="number" required />
          <Inp label="N.º Gerentes" value={form.numGerentes} onChange={v => updField("numGerentes", v)} type="number" />
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Objeto Social</label>
            <textarea value={form.objeto || ""} onChange={e => updField("objeto", e.target.value)} rows={3} style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans',sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          </div>
          <Inp label="Forma de Obrigar" value={form.formaObrigar} onChange={v => updField("formaObrigar", v)} style={{ gridColumn: "1/-1" }} />
          <Inp label="Maioria contratual (%)" value={form.maioriaContratual || ""} onChange={v => updField("maioriaContratual", v)} type="number" placeholder="75 (default)" />
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sócios Anónimos (estrutura de quotas)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" size="sm" onClick={recalcPcts}>↻ Recalcular %</Btn>
            <Btn v="secondary" size="sm" onClick={addSocio}>+ Adicionar</Btn>
          </div>
        </div>
        <div style={{ fontSize: 11, color: CL.gr, marginBottom: 12 }}>Identificadores abstratos (Sócio A, Sócio B...). Nenhum dado pessoal é guardado. Os nomes reais vão nos placeholders [NOME_SOCIO_A], [NOME_SOCIO_B], etc. no Word.</div>

        {form.socios.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px 100px 40px", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: CL.d }}>Sócio {s.id}</div>
            <Inp label={i === 0 ? "Quota (€)" : ""} value={s.quota} onChange={v => updSocio(i, "quota", v)} type="number" />
            <Inp label={i === 0 ? "Percentagem (%)" : ""} value={s.pct} onChange={v => updSocio(i, "pct", v)} type="number" />
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={!!s.penhor} onChange={e => updSocio(i, "penhor", e.target.checked)} />
              Penhor
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={!!s.usufruto} onChange={e => updSocio(i, "usufruto", e.target.checked)} />
              Usufruto
            </div>
            <Btn v="ghost" size="sm" onClick={() => removeSocio(i)} style={{ color: CL.r }}>✕</Btn>
          </div>
        ))}

        <div style={{ marginTop: 12, padding: 12, background: "#F8FAFC", borderRadius: 6, fontSize: 12, color: CL.gr }}>
          Total quotas: <strong>{fmt(form.socios.reduce((sum, s) => sum + Number(s.quota || 0), 0))}</strong> · Capital social: <strong>{fmt(Number(form.capital) || 0)}</strong>
          {form.socios.reduce((sum, s) => sum + Number(s.quota || 0), 0) !== Number(form.capital) && <span style={{ color: CL.r, marginLeft: 8 }}>⚠ Soma das quotas ≠ capital</span>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28, paddingTop: 20, borderTop: "1px solid #E5E7EB" }}>
        <Btn v="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn v="accent" onClick={handleSave}>Guardar Alterações</Btn>
      </div>
    </div>
  </div>;
}

// ── SOCIEDADES VIEW ─────────────────────────────────────────────────────

function SociedadesView() {
  const [socs, setSocs] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { setSocs(loadSociedades()); }, []);

  const handleDelete = (nipc) => {
    if (!confirm("Eliminar esta sociedade? Esta ação não pode ser desfeita.")) return;
    const filtered = loadSociedades().filter(s => s.nipc !== nipc);
    localStorage.setItem(STORE_KEY, JSON.stringify(filtered));
    setSocs(filtered);
  };

  const handleSave = (updated) => {
    setSocs(loadSociedades());
  };

  return <div>
    <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Sociedades</h1>
    <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 20px" }}>Dados públicos guardados localmente</p>

    {socs.length === 0 ? <Cd><p style={{ color: CL.gr, textAlign: "center", padding: "40px 0" }}>Sem sociedades registadas. Crie uma nova deliberação para adicionar.</p></Cd> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
        {socs.map((soc, i) => <Cd key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: CL.d, marginBottom: 4 }}>{soc.firma}</div>
              <div style={{ fontSize: 12, color: CL.gr }}>NIPC: {soc.nipc} · {soc.tipo}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <Btn v="ghost" size="sm" onClick={() => setEditing(soc)}>✎ Editar</Btn>
              <Btn v="ghost" size="sm" onClick={() => handleDelete(soc.nipc)} style={{ color: CL.r }}>✕</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 12 }}>
            <div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Capital</div><div style={{ fontWeight: 600 }}>{fmt(soc.capital)}</div></div>
            <div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Sócios</div><div style={{ fontWeight: 600 }}>{soc.socios?.length || 0}</div></div>
          </div>
          <div style={{ fontSize: 12, color: CL.gr, marginBottom: 8, padding: "8px 0", borderTop: "1px solid #F1F5F9" }}>{soc.sede}</div>
          {soc.socios?.map((s, j) => <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span>Sócio {s.id}{s.penhor ? " · penhor" : ""}{s.usufruto ? " · usufruto" : ""}</span><span style={{ fontWeight: 600 }}>{fmt(s.quota)} ({s.pct}%)</span></div>)}
        </Cd>)}
      </div>}

    {editing && <EditSociedadeModal sociedade={editing} onClose={() => setEditing(null)} onSave={handleSave} />}
  </div>;
}

// ── APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");

  return <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F1F3F5;color:#1F2937;-webkit-font-smoothing:antialiased}::selection{background:#B8976A33}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#B8976A!important;box-shadow:0 0 0 3px #B8976A18}`}</style>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={view} setActive={setView} />
      <main style={{ flex: 1, padding: "32px 40px", maxHeight: "100vh", overflow: "auto" }}>
        {view === "wizard" ? <Wizard onCancel={() => setView("dashboard")} onDone={() => setView("dashboard")} /> :
          view === "sociedades" ? <SociedadesView /> :
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}><div><h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Dashboard</h1><p style={{ fontSize: 14, color: CL.gr, margin: "6px 0 0" }}>Introduza o NIPC para começar</p></div><Btn v="accent" size="lg" onClick={() => setView("wizard")}>+ Nova Deliberação</Btn></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <Cd><div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Sociedades registadas</div><div style={{ fontSize: 32, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{loadSociedades().length}</div></Cd>
                <Cd><div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Política de privacidade</div><div style={{ fontSize: 13, color: CL.gn }}>🔒 Zero dados pessoais no servidor</div><div style={{ fontSize: 12, color: CL.gr, marginTop: 4 }}>Sócios anónimos · [PLACEHOLDERS] nos docs</div></Cd>
              </div>
              <Al type="privacy" title="Como funciona">1. Introduza o NIPC → 2. Selecione as deliberações → 3. Preencha os campos → 4. Descarregue os documentos Word com placeholders para dados pessoais.</Al>
            </div>}
      </main>
    </div>
  </>;
}
