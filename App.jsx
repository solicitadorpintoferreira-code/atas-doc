import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle, TabStopType } from "docx";
import { saveAs } from "file-saver";

// ═══════════════════════════════════════════════════════════════════════
// ATAS PRO v7 — Deliberações + Operações Societárias M&A
// ═══════════════════════════════════════════════════════════════════════
// 1. Módulo Deliberações: NIPC → Wizard → DOCX
// 2. Módulo Operações: Questionário dinâmico → Relatório "50K" via Claude API
// ═══════════════════════════════════════════════════════════════════════

// ── LOCALSTORAGE STORES ───────────────────────────────────────────────

const STORE_KEY = "atas_pro_sociedades";
const OPS_STORE_KEY = "atas_pro_operacoes";

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

function loadOperacoes() {
  try { return JSON.parse(localStorage.getItem(OPS_STORE_KEY) || "[]"); } catch { return []; }
}
function saveOperacao(op) {
  const all = loadOperacoes();
  const idx = all.findIndex(o => o.id === op.id);
  if (idx >= 0) all[idx] = op; else all.push(op);
  localStorage.setItem(OPS_STORE_KEY, JSON.stringify(all));
}

// ── TEMPLATES (DELIBERAÇÕES) ──────────────────────────────────────────

const T = {
  preambulo: (soc, uni) => uni
    ? `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu na sua sede social, sita em ${soc.sede}, em Assembleia Geral extraordinária da Sociedade ${soc.firma} (doravante apenas a "Sociedade"), registada na Conservatória do Registo Comercial sob o número único de matrícula e de identificação fiscal ${soc.nipc}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), totalmente realizado.`
    : `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede}, a Assembleia Geral Extraordinária da sociedade ${soc.tipo.toLowerCase()}, denominada "${soc.firma}", com o número único de matrícula e de identificação fiscal ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}).`,

  socio: (id) => `[NOME_SOCIO_${id}], [ESTADO_CIVIL_${id}], natural da freguesia de [NATURALIDADE_${id}], concelho de [CONCELHO_${id}], com o número de identificação fiscal [NIF_${id}], portador do Cartão de Cidadão número [CC_${id}], emitido pela República Portuguesa e válido até [CC_VALIDADE_${id}], residente em [MORADA_${id}]`,

  universal: (uni) => uni
    ? "Estando representada a totalidade do capital social, o sócio único concordou em reunir e deliberar sem formalidades prévias, nos termos do artigo 54.º do Código das Sociedades Comerciais, sobre os assuntos que constituem a seguinte ordem de trabalhos:"
    : "Verificando-se estar reunida a totalidade do capital social e tendo sido dispensadas todas as formalidades prévias de convocação nos termos do artigo 54.º do Código das Sociedades Comerciais, assumiu a presidência da assembleia o sócio-gerente [NOME_PRESIDENTE], tendo ainda os sócios manifestado a sua vontade no sentido de que a assembleia se constituísse e deliberasse sobre a seguinte ordem de trabalhos:",

  encerramento: (uni) => uni
    ? "Não havendo outros assuntos a tratar, foi encerrada a assembleia pelas [HORA_FIM] horas e lavrada a presente ata, que depois de lida e aprovada vai ser assinada pelo sócio presente."
    : "Nada mais havendo a tratar, foi encerrada a sessão pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelos sócios, em sinal de conformidade.",

  delib_cessao: (soc, fd) => `Entrou-se na discussão, tendo sido comunicado pelo sócio a cessão de quotas, efetuada por contrato particular, tendo sido cedida a quota do sócio [NOME_CEDENTE], com o valor nominal de ${fd.ces_vn ? fmt(Number(fd.ces_vn)) : "[VALOR]"}, correspondente a [PERCENTAGEM]% do capital da sociedade, a [NOME_CESSIONARIO]. Em conformidade com o disposto no artigo 228.º n.º 2 do Código das Sociedades Comerciais, a referida cessão de quotas encontra-se ${fd.ces_consentimento_exigido === "nao" ? "dispensada de consentimento da sociedade, por se tratar de negócio celebrado entre sócios" : "sujeita ao consentimento da sociedade, o qual foi deliberado e concedido por unanimidade"}.`,

  delib_aumento: (soc, fd) => {
    const m = Number(fd.aum_montante) || 0;
    const nc = (soc.capital || 0) + m;
    return `Foi apresentado um conjunto de considerações sobre a necessidade de serem reforçados os capitais próprios da sociedade, através de um aumento de capital na modalidade de novas entradas em numerário. O reforço no montante de ${fmt(m)} (${extenso(m)}) eleva o capital social de ${fmt(soc.capital)} para ${fmt(nc)} (${extenso(nc)}). ${fd.aum_realizacao_integral === "sim" ? "Declara-se, nos termos e para os efeitos do artigo 88.º do CSC, que a entrada em numerário já foi realizada, encontrando-se o respetivo valor depositado nos cofres da Sociedade." : "As entradas serão realizadas no prazo de [PRAZO_REALIZACAO]."}`;
  },

  delib_alteracao_firma: (soc, fd) => `Foi deliberado e aprovado a alteração da firma da sociedade, que passa a ser: "${fd.novo_texto || "[NOVA_FIRMA]"}".${fd.cert_dispensado ? ` A alteração de firma não necessita de certificado de admissibilidade, ${fd.cert_motivo_dispensa || "por a alteração decorrente de transformação se restringir à alteração do elemento que identifica o tipo de pessoa coletiva — art. 54.º, n.º 3 do RJRNPC"}.` : ` A admissibilidade da nova firma foi objeto do certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,

  delib_alteracao_sede: (soc, fd) => `Foi deliberado e aprovado a alteração da sede da sociedade para: "${fd.novo_texto || "[NOVA_SEDE]"}".${fd.cert_dispensado ? ` A alteração de sede não necessita de certificado de admissibilidade, ${fd.cert_motivo_dispensa || "por a firma ser constituída por expressão de fantasia — art. 54.º, n.º 3 do RJRNPC"}.` : ` Certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,

  delib_alteracao_objeto: (soc, fd) => `Foi deliberado e aprovado a alteração do objeto social da sociedade, que passa a ter a seguinte redação: "${fd.novo_texto || "[NOVO_OBJETO]"}".${fd.cert_dispensado ? ` Não é necessário certificado de admissibilidade.` : ` Certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,

  delib_nomeacao_gerente: () => `Foi proposto e aprovado por unanimidade a nomeação de [NOME_GERENTE_NOVO], [ESTADO_CIVIL_GERENTE], NIF [NIF_GERENTE_NOVO], residente em [MORADA_GERENTE_NOVO], para o cargo de gerente da sociedade. O nomeado declara aceitar o cargo para que foi eleito.`,

  delib_destituicao: (fd) => `Foi deliberado a destituição de [NOME_GERENTE_DESTITUIDO] do cargo de gerente${fd.dest_justa_causa === "sim" ? ", com justa causa" : ". A destituição opera sem invocação de justa causa, ficando ressalvado o direito a eventual indemnização nos termos legais"}.`,

  delib_dissolucao: (fd) => `Foi deliberado, por unanimidade, a dissolução da sociedade, ao abrigo do artigo 141.º, n.º 1, alínea b) do CSC${fd.dis_fund ? `, com o seguinte fundamento: ${fd.dis_fund}` : ""}. A firma passa a incluir a menção "em liquidação".`,

  delib_contas: (fd) => `Foi apresentado o balanço, a demonstração de resultados e demais documentos referentes ao exercício de ${fd.ct_exercicio || "[ANO]"}, tendo sido deliberado ${fd.ct_decisao === "aprovadas" ? "aprovar" : "não aprovar"} as contas, com resultado líquido de ${fd.ct_resultado ? fmt(Number(fd.ct_resultado)) : "[VALOR]"}.`,

  delib_lucros: (fd) => `Foi deliberado proceder à distribuição de resultados no montante de ${fd.dl_total ? fmt(Number(fd.dl_total)) : "[VALOR]"}, na proporção das respetivas participações sociais.`,
};

// ── DOCX GENERATION (DELIBERAÇÕES) ────────────────────────────────────

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

  children.push(p(`ATA N.º [NÚMERO]`, { center: true, bold: true, after: 400 }));
  children.push(p(T.preambulo(soc, uni)));
  children.push(p(uni ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:", { before: 200 }));
  soc.socios.forEach((s, i) => {
    children.push(p(`${String.fromCharCode(97 + i)}) ${T.socio(s.id)}, titular de uma quota no valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`, { indent: true }));
  });
  children.push(p(T.universal(uni), { before: 200 }));
  selDel.forEach((did, i) => {
    children.push(p(`Ponto ${pontos[i] || i + 1}: ${getOrdemDia(did, fdMap[did] || {})}`, { bold: true }));
  });
  selDel.forEach((did, i) => {
    const fd = fdMap[did] || {};
    children.push(p(`Entrou-se ${i === 0 ? "de imediato" : "seguidamente"} na discussão do Ponto ${pontos[i] || i + 1} da Ordem de Trabalhos.`, { before: 300, bold: true }));
    children.push(p(getDelibText(did, soc, fd)));
  });
  children.push(p(T.encerramento(uni), { before: 400 }));
  soc.socios.forEach(s => {
    children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
    children.push(p("______________________________"));
    children.push(p(`[NOME_SOCIO_${s.id}]`));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }],
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

// ── DOCX GENERATION (RELATÓRIO OPERAÇÕES) ─────────────────────────────

async function generateReportDocx(title, analysisText) {
  if (!analysisText) return;
  const children = [];

  const addParagraph = (text, opts = {}) => {
    const runs = [];
    // Parse markdown bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach(part => {
      if (part.startsWith("**") && part.endsWith("**")) {
        runs.push(new TextRun({ text: part.slice(2, -2), font: "Times New Roman", size: 24, bold: true }));
      } else {
        runs.push(new TextRun({ text: part, font: "Times New Roman", size: 24, bold: opts.bold || false, italics: opts.italics || false }));
      }
    });
    children.push(new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 },
      indent: opts.indent ? { left: 720 } : undefined,
      children: runs,
    }));
  };

  // Title page
  children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
  addParagraph("RELATÓRIO DE REORGANIZAÇÃO SOCIETÁRIA", { center: true, bold: true, after: 100 });
  addParagraph("E ESTRUTURAÇÃO DE OPERAÇÃO", { center: true, bold: true, after: 400 });
  addParagraph(title || "Operação", { center: true, after: 200 });
  addParagraph("P&A Legal", { center: true, after: 100 });
  addParagraph("Data: " + new Date().toLocaleDateString("pt-PT"), { center: true, after: 100 });
  addParagraph("RASCUNHO — CONFIDENCIAL — Para revisão por advogado sénior", { center: true, after: 600, italics: true });

  // Parse analysis text
  const lines = analysisText.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      continue;
    }
    if (t.startsWith("# ")) {
      addParagraph(t.replace(/^#+\s*/, ""), { bold: true, before: 400, after: 200 });
    } else if (t.startsWith("## ")) {
      addParagraph(t.replace(/^#+\s*/, ""), { bold: true, before: 300, after: 150 });
    } else if (t.startsWith("### ")) {
      addParagraph(t.replace(/^#+\s*/, ""), { bold: true, before: 250, after: 100 });
    } else if (t.startsWith("#### ")) {
      addParagraph(t.replace(/^#+\s*/, ""), { bold: true, before: 200 });
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      addParagraph("• " + t.slice(2), { indent: true });
    } else if (/^\d+\.\s/.test(t)) {
      addParagraph(t, { indent: true });
    } else if (t.includes("A VALIDAR COM O FISCALISTA") || t.includes("A validar com o fiscalista")) {
      // Fiscal validation box
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 200, before: 100 },
        indent: { left: 720, right: 720 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D97706" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D97706" },
          left: { style: BorderStyle.SINGLE, size: 6, color: "D97706" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D97706" },
        },
        children: [new TextRun({ text: "⚠ " + t, font: "Times New Roman", size: 22, bold: true, italics: true })],
      }));
    } else if (t.startsWith("INFORMAÇÃO EM FALTA") || t.startsWith("ASSUNÇÃO")) {
      addParagraph(t, { bold: true, italics: true });
    } else {
      addParagraph(t);
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Relatorio_" + (title || "operacao").replace(/[^a-zA-Z0-9áàãâéèêíìóòõôúùçÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÇ\s]/g, "").replace(/\s+/g, "_").substring(0, 60) + ".docx");
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
  if (dt?.certAdm && !fd.cert_dispensado && !fd.cert_numero) W.push("Indicar número do certificado de admissibilidade ou marcar dispensa.");
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
    if(did==="cessao_quotas")docs.add("Contrato de Cessão");
    if(did==="nomeacao_gerente")docs.add("Aceitação de Gerente");
    if(did==="suprimentos")docs.add("Contrato de Suprimento");
    if(did==="aprovacao_contas")docs.add("Depósito de Contas");
    if(did==="distribuicao_lucros")docs.add("Recibos de Dividendos");
  });
  return {fx,docs:Array.from(docs)};
}

// ── UI PRIMITIVES ───────────────────────────────────────────────────────

const CL={d:"#0F172A",g:"#B8976A",gr:"#6B7280",gn:"#059669",r:"#DC2626",bl:"#2563EB",am:"#D97706"};

function Badge({t,type}){const m={pacto:{bg:"#FEF3C7",c:"#92400E",i:"◆"},lista:{bg:"#DBEAFE",c:"#1E40AF",i:"☰"},registo:{bg:"#FCE7F3",c:"#9D174D",i:"⬡"},rcbe:{bg:"#F3E8FF",c:"#6B21A8",i:"◎"},block:{bg:"#FEE2E2",c:"#991B1B",i:"⛔"},warn:{bg:"#FFFBEB",c:"#92400E",i:"⚠"},info:{bg:"#EFF6FF",c:"#1E40AF",i:"ℹ"},legal:{bg:"#FDF8F0",c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",c:"#166534",i:"🔒"},fiscal:{bg:"#FFF7ED",c:"#9A3412",i:"⚠"}}[type]||{bg:"#F3F4F6",c:"#374151",i:"•"};return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,background:m.bg,color:m.c}}>{m.i} {t}</span>;}

function Cd({children,style,onClick,hover}){const[h,sH]=useState(false);return<div onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:24,transition:"all 0.2s",cursor:onClick?"pointer":"default",...(hover&&h?{borderColor:CL.g,boxShadow:"0 4px 12px rgba(184,151,106,0.12)"}:{}),...style}}>{children}</div>;}

function Inp({label,value,onChange,placeholder,type="text",required,disabled,eph,style:sx,multiline,rows}){
  if(multiline) return <div style={{display:"flex",flexDirection:"column",gap:6,...sx}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}</label>}<textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} rows={rows||4} style={{padding:"10px 14px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#1F2937",background:disabled?"#F9FAFB":"#fff",outline:"none",resize:"vertical",boxSizing:"border-box"}} /></div>;return<div style={{display:"flex",flexDirection:"column",gap:6,...sx}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}{eph&&<span style={{fontSize:9,color:CL.gn,fontWeight:600,background:"#ECFDF5",padding:"1px 6px",borderRadius:3,marginLeft:6}}>placeholder</span>}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{padding:"10px 14px",border:`1px solid ${eph?"#A7F3D0":"#D1D5DB"}`,borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#1F2937",background:disabled?"#F9FAFB":eph?"#F0FDF9":"#fff",outline:"none"}} onFocus={e=>e.target.style.borderColor=CL.g} onBlur={e=>e.target.style.borderColor=eph?"#A7F3D0":"#D1D5DB"}/></div>;}

function Sel({label,value,onChange,options,required,placeholder}){return<div style={{display:"flex",flexDirection:"column",gap:6}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{padding:"10px 14px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:value?"#1F2937":"#9CA3AF",background:"#fff",outline:"none",cursor:"pointer"}}><option value="">{placeholder||"Selecionar..."}</option>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select></div>;}

function Rad({label,value,onChange,options,required}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:CL.g}}> *</span>}</label>}<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{options.map(o=><div key={o.v} onClick={()=>onChange(o.v)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:6,cursor:"pointer",border:value===o.v?`2px solid ${CL.d}`:"1px solid #D1D5DB",background:value===o.v?"#F0F4FF":"#fff",fontSize:13,fontWeight:value===o.v?600:400}}><div style={{width:16,height:16,borderRadius:"50%",border:value===o.v?"none":"2px solid #D1D5DB",background:value===o.v?CL.d:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{value===o.v&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}</div>{o.l}</div>)}</div></div>;}

function Btn({children,onClick,v="primary",size="md",disabled,style:sx}){const s={primary:{bg:CL.d,c:"#fff",b:"none"},secondary:{bg:"#fff",c:CL.d,b:"1px solid #D1D5DB"},accent:{bg:CL.g,c:"#fff",b:"none"},ghost:{bg:"transparent",c:CL.gr,b:"none"},danger:{bg:"#DC2626",c:"#fff",b:"none"}}[v];return<button onClick={onClick} disabled={disabled} style={{padding:size==="sm"?"8px 16px":size==="lg"?"14px 28px":"10px 20px",borderRadius:6,fontSize:size==="sm"?12:size==="lg"?15:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:8,background:disabled?"#E5E7EB":s.bg,color:disabled?"#9CA3AF":s.c,border:s.b||"none",opacity:disabled?0.7:1,...sx}}>{children}</button>;}

function Al({type,title,children}){const m={info:{bg:"#EFF6FF",b:"#3B82F6",c:"#1E40AF",i:"ℹ"},warning:{bg:"#FFFBEB",b:"#F59E0B",c:"#92400E",i:"⚠"},block:{bg:"#FEE2E2",b:"#EF4444",c:"#991B1B",i:"⛔"},legal:{bg:"#FDF8F0",b:CL.g,c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",b:CL.gn,c:"#166534",i:"🔒"},success:{bg:"#F0FDF4",b:"#22C55E",c:"#166534",i:"✓"},fiscal:{bg:"#FFF7ED",b:"#EA580C",c:"#9A3412",i:"⚠"}}[type];return<div style={{display:"flex",gap:14,padding:16,borderRadius:8,background:m.bg,borderLeft:`3px solid ${m.b}`}}><span style={{fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>{m.i}</span><div>{title&&<div style={{fontSize:13,fontWeight:600,color:m.c,marginBottom:4}}>{title}</div>}<div style={{fontSize:13,color:m.c,lineHeight:1.5}}>{children}</div></div></div>;}

function Steps({steps,cur}){return<div style={{display:"flex",alignItems:"center",padding:"0 0 32px"}}>{steps.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:i<=cur?CL.d:"#E5E7EB",color:i<=cur?"#fff":"#9CA3AF"}}>{i<cur?"✓":i+1}</div><span style={{fontSize:13,fontWeight:i===cur?600:400,color:i<=cur?CL.d:"#9CA3AF",whiteSpace:"nowrap"}}>{s}</span></div>{i<steps.length-1&&<div style={{flex:1,height:2,margin:"0 16px",background:i<cur?CL.d:"#E5E7EB"}}/>}</div>)}</div>;}

function DocText({text}){if(!text)return null;const parts=text.split(/(\[[A-Z_]+(?:_[A-Z0-9]+)*\])/g);return<>{parts.map((p,i)=>p.startsWith("[")&&p.endsWith("]")?<span key={i} style={{background:"#FEF3C7",color:"#92400E",padding:"1px 4px",borderRadius:3,fontWeight:600,fontSize:"0.95em",fontFamily:"monospace"}}>{p}</span>:<span key={i}>{p}</span>)}</>;}

function ProgressBar({ value, label }) {
  return <div style={{ marginBottom: 8 }}>
    {label && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: value >= 100 ? CL.gn : CL.g }}>{Math.min(Math.round(value), 100)}%</span>
    </div>}
    <div style={{ height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 3, background: value >= 100 ? CL.gn : `linear-gradient(90deg, ${CL.g}, #D4B88C)`, width: `${Math.min(value, 100)}%`, transition: "width 0.4s ease" }} />
    </div>
  </div>;
}

// ── SIDEBAR ─────────────────────────────────────────────────────────────

function Sidebar({active,setActive}){
  const nav=[
    {id:"dashboard",l:"Dashboard",i:"⊞"},
    {id:"wizard",l:"Nova Deliberação",i:"+"},
    {id:"operacoes",l:"Operações M&A",i:"⇌"},
    {id:"sociedades",l:"Sociedades",i:"◈"},
  ];
  return<div style={{width:260,minHeight:"100vh",background:CL.d,display:"flex",flexDirection:"column",flexShrink:0}}>
    <div style={{padding:"28px 24px 24px",borderBottom:"1px solid #1E293B"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${CL.g},#D4B88C)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:CL.d}}>§</div><div><div style={{fontSize:17,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.02em",fontFamily:"'Playfair Display',serif"}}>ATAS PRO</div><div style={{fontSize:10,color:"#64748B",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:500}}>v7</div></div></div></div>
    <nav style={{padding:"16px 12px",flex:1}}>{nav.map(n=><button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:active===n.id?600:400,fontFamily:"'DM Sans',sans-serif",marginBottom:4,background:active===n.id?"#1E293B":"transparent",color:active===n.id?"#F1F5F9":"#94A3B8"}}><span style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:active===n.id?CL.g+"22":"transparent",color:active===n.id?CL.g:"#64748B"}}>{n.i}</span>{n.l}</button>)}</nav>
    <div style={{padding:"16px 24px 24px",borderTop:"1px solid #1E293B"}}><div style={{fontSize:10,color:CL.gn,fontWeight:500}}>P&A Legal — uso interno</div></div>
  </div>;
}

// ── NIPC INPUT ──────────────────────────────────────────────────────────

function NipcInput({ onSociedadeReady }) {
  const [nipc, setNipc] = useState("");
  const [soc, setSoc] = useState(null);
  const [mode, setMode] = useState("search");
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
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
      <Inp label="NIPC" value={nipc} onChange={setNipc} placeholder="Ex: 516234567" required style={{ flex: 1 }} />
      <Btn onClick={search} disabled={nipc.replace(/[\s.]/g, "").length < 9}>Procurar</Btn>
    </div>
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
    {mode === "create" && <div>
      <Al type="info" title="Sociedade não encontrada">Preencha os dados públicos da sociedade. Ficam guardados para utilização futura.</Al>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Inp label="Firma" value={form.firma} onChange={v => setForm(f => ({ ...f, firma: v }))} required placeholder="Ex: Empresa, Lda." />
        <Sel label="Tipo" value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))} options={[{ v: "Sociedade por Quotas", l: "Sociedade por Quotas" }, { v: "Sociedade Unipessoal por Quotas", l: "Soc. Unipessoal por Quotas" }, { v: "Sociedade Anónima", l: "Sociedade Anónima" }]} />
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

// ── CERTIFICADO DE ADMISSIBILIDADE ──────────────────────────────────────

function CertAdmissibilidade({ fd, upd }) {
  return <div style={{ background: "#FFFBEB", borderRadius: 8, padding: 16, border: "1px solid #FDE68A", marginTop: 8 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 12 }}>Certificado de Admissibilidade</div>
    <Rad label="Necessita de certificado?" value={fd.cert_dispensado ? "nao" : "sim"} onChange={v => upd("cert_dispensado", v === "nao")} options={[{ v: "sim", l: "Sim — indicar número" }, { v: "nao", l: "Dispensado" }]} required />
    {!fd.cert_dispensado && <div style={{ marginTop: 12 }}>
      <Inp label="N.º do Certificado de Admissibilidade" value={fd.cert_numero} onChange={v => upd("cert_numero", v)} required placeholder="Ex: 12345/2026" />
    </div>}
    {fd.cert_dispensado && <div style={{ marginTop: 12 }}>
      <Sel label="Motivo de dispensa" value={fd.cert_motivo_dispensa_id} onChange={v => { upd("cert_motivo_dispensa_id", v); upd("cert_motivo_dispensa", CERT_DISPENSAS.find(c => c.id === v)?.l || ""); }} options={CERT_DISPENSAS.map(c => ({ v: c.id, l: c.l }))} required placeholder="Selecionar motivo..." />
    </div>}
  </div>;
}

// ── WIZARD (DELIBERAÇÕES) ──────────────────────────────────────────────

function Wizard({ onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [soc, setSoc] = useState(null);
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [downloading, setDownloading] = useState(false);

  const stNames = ["Sociedade", "Deliberações", "Formulários", "Documentos", "Download"];
  const getFd = did => fdMap[did] || {};
  const upd = (did, k, v) => setFdMap(p => ({ ...p, [did]: { ...(p[did] || {}), [k]: v } }));
  const togDel = id => setSelDel(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);

  const allVal = useMemo(() => { const r = {}; selDel.forEach(did => { r[did] = validate(did, getFd(did), soc); }); return r; }, [selDel, fdMap, soc]);
  const hasBlock = useMemo(() => Object.values(allVal).some(v => v.B.length > 0), [allVal]);
  const { fx, docs } = useMemo(() => computeEffects(selDel, fdMap), [selDel, fdMap]);

  const handleDownload = async (docName) => {
    setDownloading(true);
    try {
      if (docName === "Ata") await generateAtaDocx(soc, selDel, fdMap);
      else if (docName === "Lista de Sócios") await generateListaSociosDocx(soc);
      else alert(`Geração de "${docName}" — em desenvolvimento.`);
    } catch (e) { console.error("Erro DOCX:", e); alert("Erro ao gerar documento: " + e.message); }
    setDownloading(false);
  };

  const renderForm = (did) => {
    const fd = getFd(did); const u = (k, v) => upd(did, k, v); const v = allVal[did] || { B: [], W: [], I: [] };

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
        <Rad label="Consentimento exigido?" value={fd.ces_consentimento_exigido} onChange={v => u("ces_consentimento_exigido", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não (livre)" }]} required />
        {fd.ces_consentimento_exigido === "sim" && <Rad label="Consentimento dado?" value={fd.ces_consentimento_dado} onChange={v => u("ces_consentimento_dado", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Recusa" }]} required />}
      </>}

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

    {step === 0 && <div><NipcInput onSociedadeReady={setSoc} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}><Btn disabled={!soc} onClick={() => setStep(1)}>Continuar →</Btn></div></div>}

    {step === 1 && <div>
      <Cd style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16, fontWeight: 600, color: CL.d, margin: "0 0 20px" }}>Deliberações</h3>
        {Object.entries(CATS).map(([cid, cl]) => { const items = DELIB_TYPES.filter(d => d.cat === cid); return <div key={cid} style={{ marginBottom: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>{cl}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{items.map(d => { const sel = selDel.includes(d.id); return <div key={d.id} onClick={() => togDel(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer", border: sel ? `2px solid ${CL.d}` : "1px solid #E5E7EB", background: sel ? "#F0F4FF" : "#fff" }}><div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? "none" : "2px solid #D1D5DB", background: sel ? CL.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{sel ? "✓" : ""}</div><div><div style={{ fontSize: 13, fontWeight: sel ? 600 : 500 }}><span style={{ marginRight: 6, opacity: 0.5 }}>{d.icon}</span>{d.label}</div><div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{d.pacto && <Badge t="Pacto" type="pacto" />}{d.lista && <Badge t="Lista" type="lista" />}{d.registo && <Badge t="Registo" type="registo" />}{d.rcbe && <Badge t="RCBE" type="rcbe" />}{d.certAdm && <Badge t="Cert. Adm." type="warn" />}</div></div></div> })}</div></div> })}
      </Cd>
      {selDel.length > 0 && <Cd style={{ background: "#FAFBFD", marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{selDel.length} deliberação(ões) · {soc?.firma}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>{fx.pacto && <Badge t="Pacto Social" type="pacto" />}{fx.lista && <Badge t="Lista Sócios" type="lista" />}{fx.registo && <Badge t="Registo" type="registo" />}{fx.rcbe && <Badge t="RCBE" type="rcbe" />}</div><div style={{ fontSize: 12, color: CL.gr }}>Docs: {docs.join(" · ")}</div></Cd>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(0)}>← Voltar</Btn><Btn disabled={selDel.length === 0} onClick={() => setStep(2)}>Continuar →</Btn></div>
    </div>}

    {step === 2 && <div>
      {fx.rcbe && <div style={{ marginBottom: 12 }}><Al type="warning" title="RCBE">Atualização obrigatória em 30 dias (art. 14.º Lei 89/2017).</Al></div>}
      {selDel.map(did => { const dt = DELIB_TYPES.find(d => d.id === did); return <Cd key={did} style={{ marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: CL.d, display: "flex", alignItems: "center", justifyContent: "center", color: CL.g, fontSize: 14, fontWeight: 700 }}>{dt.icon}</div><h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{dt.label}</h3></div>{renderForm(did)}</Cd> })}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(1)}>← Voltar</Btn><Btn disabled={hasBlock} onClick={() => setStep(3)}>{hasBlock ? "Bloqueios ⛔" : "Documentos →"}</Btn></div>
    </div>}

    {step === 3 && soc && <div>
      <Cd style={{ padding: 40, marginBottom: 24 }}>
        <div style={{ fontFamily: "'Times New Roman',serif", fontSize: 13, lineHeight: 2, maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}><h2 style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>ATA N.º [NÚMERO]</h2></div>
          <p><DocText text={T.preambulo(soc, soc.socios.length === 1)} /></p>
          <p style={{ marginTop: 16 }}><DocText text={soc.socios.length === 1 ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:"} /></p>
          {soc.socios.map((s, i) => <p key={i} style={{ paddingLeft: 20 }}><DocText text={`${String.fromCharCode(97 + i)}) ${T.socio(s.id)}, titular de uma quota de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`} /></p>)}
          <p style={{ marginTop: 16 }}><DocText text={T.universal(soc.socios.length === 1)} /></p>
          {selDel.map((did, i) => <p key={did} style={{ fontWeight: 600 }}>Ponto {["Um", "Dois", "Três", "Quatro", "Cinco"][i] || i + 1}: <DocText text={getOrdemDia(did, getFd(did))} /></p>)}
          {selDel.map((did, i) => <div key={did} style={{ marginTop: 24 }}><p><DocText text={getDelibText(did, soc, getFd(did))} /></p></div>)}
          <p style={{ marginTop: 32 }}><DocText text={T.encerramento(soc.socios.length === 1)} /></p>
          {soc.socios.map((s, i) => <div key={i} style={{ marginTop: 32 }}><div style={{ borderTop: "1px solid #374151", width: 250, marginBottom: 4 }} /><DocText text={`[NOME_SOCIO_${s.id}]`} /></div>)}
        </div>
      </Cd>
      <div style={{ display: "flex", justifyContent: "space-between" }}><Btn v="secondary" onClick={() => setStep(2)}>← Voltar</Btn><Btn v="accent" onClick={() => setStep(4)}>Download →</Btn></div>
    </div>}

    {step === 4 && <Cd style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", border: "2px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✓</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Documentos Prontos</h2>
      <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 6px" }}>{soc?.firma}</p>
      <p style={{ fontSize: 12, color: CL.gn, margin: "0 0 32px" }}>🔒 Com [PLACEHOLDERS] — preencher dados pessoais em Word</p>
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "left" }}>{docs.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 8, marginBottom: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>📄</span><span style={{ fontSize: 13, fontWeight: 500 }}>{d}</span></div><Btn v="accent" size="sm" onClick={() => handleDownload(d)} disabled={downloading}>{downloading ? "..." : "DOCX ↓"}</Btn></div>)}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}><Btn v="secondary" onClick={() => setStep(3)}>← Rever</Btn><Btn v="accent" onClick={onDone}>Concluir</Btn></div>
    </Cd>}
  </div>;
}

// ── SOCIEDADES VIEW ─────────────────────────────────────────────────────

function SociedadesView() {
  const [socs, setSocs] = useState([]);
  useEffect(() => { setSocs(loadSociedades()); }, []);

  return <div>
    <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Sociedades</h1>
    <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 20px" }}>Dados públicos guardados localmente (localStorage)</p>
    {socs.length === 0 ? <Cd><p style={{ color: CL.gr, textAlign: "center", padding: "40px 0" }}>Sem sociedades registadas. Crie uma nova deliberação para adicionar.</p></Cd> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
        {socs.map((soc, i) => <Cd key={i}>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 16, fontWeight: 700, color: CL.d, marginBottom: 4 }}>{soc.firma}</div><div style={{ fontSize: 12, color: CL.gr }}>NIPC: {soc.nipc} · {soc.tipo}</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 12 }}><div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Capital</div><div style={{ fontWeight: 600 }}>{fmt(soc.capital)}</div></div><div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Sócios</div><div style={{ fontWeight: 600 }}>{soc.socios?.length || 0}</div></div></div>
          {soc.socios?.map((s, j) => <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span>Sócio {s.id}</span><span style={{ fontWeight: 600 }}>{fmt(s.quota)} ({s.pct}%)</span></div>)}
        </Cd>)}
      </div>}
  </div>;
}


// ═══════════════════════════════════════════════════════════════════════
// OPERAÇÕES — Reorganização Societária, M&A, Reestruturação
// ═══════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT_OPERACOES = `És uma IA jurídica avançada, a operar em Portugal, criada para apoiar advogados especializados em Direito Societário e M&A na estruturação de operações complexas de reorganização societária e M&A.

Não és um advogado autónomo nem substituis o julgamento profissional humano. És uma ferramenta de produção de relatórios altamente estruturados, com qualidade equiparável a um parecer de reorganização societária de topo (qualidade "50K").

ÂMBITO JURÍDICO:
- Direito societário / M&A: Lda., SA, unipessoais, participações, quotas próprias, transmissões, amortizações, sucessão mortis causa, acordos parassociais, relações de grupo, participações recíprocas.
- Operações de reorganização: criação de holding, permuta de participações sociais, fusões, cisões, entradas de ativos, reorganização de grupos familiares, dissoluções e liquidações.
- Operações de M&A: compra e venda de quotas (share deal), compra e venda de ativos/estabelecimento (asset deal), combinações (modelo híbrido).
- Questões patrimoniais e imobiliárias: sociedades imobiliárias, segregação de imóveis, fix-and-flip, buy-and-hold.
- Direito do Trabalho: transmissão de estabelecimento/unidade económica (arts. 285.º e 286.º CT).

FISCALIDADE — MODO "CRUZAMENTO + ALERTA":
- Nunca dás parecer fiscal definitivo.
- Sempre que identificas um impacto fiscal, escreves a análise de alto nível e acrescentas: "**⚠ A VALIDAR COM O FISCALISTA**"
- Temas que deves saber cruzar:
  * Permuta de partes sociais e regime especial de neutralidade em IRC (CIRC, artigos 73.º, 77.º, 86.º, 68.º)
  * Regime especial aplicável a fusões, cisões e entradas de ativos
  * Mais-valias em regime geral
  * Participation exemption
  * Imposto do selo em transmissões gratuitas (doação de quotas, estabelecimentos) — verba 1.2 CIS
  * Isenções subjetivas em imposto do selo (cônjuge, descendentes, ascendentes) — art. 6.º CIS
  * Regime simplificado, sociedade de apoio à gestão (art. 86.º-A CIRC)

CRUZAMENTOS OBRIGATÓRIOS:
1. Doação de quotas → Imposto do Selo (verba 1.2 CIS) → Verificar se há isenção (art. 6.º CIS: cônjuge/descendentes/ascendentes)
2. Permuta de participações → Regime especial de neutralidade (CIRC arts. 73.º, 77.º) vs Regime geral
3. Cisão/Fusão/Entrada de ativos → Regime especial vs Regime geral, com explicação de requisitos
4. Transmissão de estabelecimento com trabalhadores → Regime laboral (arts. 285.º e 286.º CT): transmissão automática da posição de empregador, manutenção de direitos, responsabilidade solidária, prazos de informação/consulta

LIMITES E REGRAS ABSOLUTAS:
- Não inventes artigos nem normas. Se não souberes o número do artigo, usa apenas o nome do código e o conceito.
- Nunca digas "esta é a única solução". Apresenta sempre cenários/opções (pelo menos 2).
- Para cada cenário: lógica geral, passos concretos, implicações societárias, implicações fiscais a alto nível, riscos e desvantagens.
- Nunca assumas factos que não te foram dados. Quando precisares de factos ausentes, escreve "INFORMAÇÃO EM FALTA" e formula perguntas concretas.

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

1. **Contextualização** — Quem é o cliente, que sociedades/negócios tem, qual é o trigger.
2. **Composição Societária Atual** — Subsecção por cada sociedade: NIF, tipo, sede, objeto, sócios e percentagens, capital social, gerência/órgãos, notas relevantes.
3. **Principais Aspetos a Considerar** — Temas críticos, riscos, conflitos, dívidas, mistura de negócios.
4. **Objetivos da Reorganização / Operação** — Separar atividades, criar holding, isolar património, preparar entrada de investidor, vender negócio, etc.
5. **Estrutura Societária Futura / Arquitetura Empresarial** — Nível de participação e controlo (holding), nível operacional, nível de apoio e património.
6. **Implementação — Opção 1** (ex.: permuta/neutralidade/regime especial) — lógica geral, enquadramento fiscal alto nível, passos concretos, aplicação por sociedade. Com caixa "**⚠ A VALIDAR COM O FISCALISTA**".
7. **Implementação — Opção 2** (ex.: regime geral: cessões de quotas, aumentos de capital) — com efeitos de mais-valias, eventual imposto do selo. Com caixa "**⚠ A VALIDAR COM O FISCALISTA**".
8. **Governança** (se aplicável) — Pacto social, acordos parassociais, mecanismos de proteção, deadlock, tag/drag.
9. **Conclusão Estratégica e Enquadramento da Decisão** — Síntese dos cenários, qual tende a alinhar-se melhor, indicação que a escolha final depende de validação fiscal.
10. **Considerações Finais e Próximos Passos** — O que fazer a seguir.
11. **Resumo Executivo** (1 página) — Fotografia atual (5-7 bullets), estrutura pretendida (5-7 bullets), 2-3 riscos-chave, síntese das opções, 3 próximos passos.

SECÇÕES OPCIONAIS (só se houver dados):
- Sociedade de Apoio à Gestão (regime simplificado)
- Sociedade de Investimento e Gestão Imobiliária
- Elegibilidade para Apoios e Fundos
- Marca e Outros Intangíveis

Se a informação fornecida incluir dados sobre transmissões gratuitas de quotas, deves OBRIGATORIAMENTE cruzar com imposto do selo (verba 1.2 CIS) e verificar isenções (art. 6.º CIS).

ESTILO:
- Português europeu.
- Tom profissional, como um parecer interno de um grande escritório.
- Frases claras e compreensíveis.
- Evita frases vazias.
- Qualidade de relatório de honorário > €50.000.`;

// ── INTAKE FIELDS (OPERAÇÕES) ─────────────────────────────────────────

const OP_INTAKE_FIELDS = [
  { section: "A — Contexto geral e objetivo", icon: "🎯", fields: [
    { id: "ctx_trigger", label: "O que motivou esta operação?", type: "textarea", placeholder: "Ex: Reestruturação, venda, sucessão, entrada de investidor, isolamento de imóveis..." },
    { id: "ctx_objetivo", label: "Objetivo principal pretendido", type: "textarea", placeholder: "Ex: Criar holding, separar negócios, preparar venda de um ramo..." },
    { id: "ctx_restricoes", label: "Restrições ou preferências (ex: evitar cisões, evitar dissolução)", type: "textarea", placeholder: "Ex: Evitar neutralidade fiscal, limitar custos, prazo máximo 3 meses..." },
  ]},
  { section: "B — Composição societária atual", icon: "🏢", fields: [
    { id: "soc_lista", label: "Sociedades envolvidas (firma, NIPC, tipo, sede, objeto)", type: "textarea", placeholder: "Sociedade 1: X Lda., NIPC ..., sede ..., objeto ...\nSociedade 2: ..." },
    { id: "soc_socios", label: "Sócios/acionistas e percentagens (por sociedade)", type: "textarea", placeholder: "Soc. 1: Sócio A — 60%, Sócio B — 40%\nSoc. 2: ..." },
    { id: "soc_capital", label: "Capital social de cada sociedade", type: "textarea", placeholder: "Soc. 1: €50.000\nSoc. 2: €5.000" },
    { id: "soc_gerencia", label: "Gerência/administração e forma de obrigar", type: "textarea", placeholder: "Soc. 1: Gerente A, obriga-se com assinatura de 1 gerente" },
    { id: "soc_relacoes_grupo", label: "Relações de grupo, participações cruzadas, acordos parassociais", type: "textarea", placeholder: "Soc. 1 detém 100% da Soc. 2; acordo parassocial entre A e B..." },
  ]},
  { section: "C — Atividade e negócios", icon: "📊", fields: [
    { id: "neg_descricao", label: "Atividade/negócios de cada sociedade", type: "textarea", placeholder: "Soc. 1: Restauração. Soc. 2: Gestão imobiliária..." },
    { id: "neg_receitas", label: "Volume de negócios aproximado (por sociedade)", type: "textarea", placeholder: "Soc. 1: ~€500K/ano. Soc. 2: ~€120K/ano" },
    { id: "neg_contratos", label: "Contratos relevantes (arrendamentos, fornecedores-chave, licenças)", type: "textarea", placeholder: "Arrendamento do imóvel X, contrato de franchising, licença de exploração..." },
  ]},
  { section: "D — Ativos relevantes", icon: "🏠", fields: [
    { id: "ativos_quotas", label: "Participações sociais detidas", type: "textarea", placeholder: "Sócio A detém quotas na Soc. 1 e Soc. 2..." },
    { id: "ativos_imoveis", label: "Imóveis (descrição, proprietário, afetação, ónus)", type: "textarea", placeholder: "Imóvel 1: Loja na Rua X, propriedade da Soc. 2, hipoteca Banco Z..." },
    { id: "ativos_marcas", label: "Marcas, patentes, outros intangíveis", type: "text", placeholder: "Marca registada 'X', domínio web, software proprietário..." },
    { id: "ativos_estabelecimentos", label: "Estabelecimentos comerciais", type: "textarea", placeholder: "Estabelecimento de restauração, com alvará, afeto à Soc. 1..." },
  ]},
  { section: "E — Pessoas, família, partes relacionadas", icon: "👥", fields: [
    { id: "fam_estrutura", label: "Relações familiares entre sócios/partes", type: "textarea", placeholder: "Sócio A é pai do Sócio B. Cônjuge do Sócio A detém a Soc. imobiliária..." },
    { id: "fam_sucessao", label: "Questões de sucessão (se aplicável)", type: "textarea", placeholder: "Sócio sénior pretende transmitir quotas aos filhos, planeamento sucessório..." },
    { id: "fam_transmissoes_gratuitas", label: "Transmissões gratuitas previstas (doação de quotas, etc.)", type: "textarea", placeholder: "Doação de quotas do pai aos filhos, doação de estabelecimento..." },
    { id: "fam_parentesco_detalhe", label: "Grau de parentesco nas transmissões (cônjuge, descendente, ascendente, terceiro)", type: "text", placeholder: "Ex: Pai para filhos (descendentes diretos)" },
  ]},
  { section: "F — Situação financeira, dívidas, litígios", icon: "⚖️", fields: [
    { id: "fin_dividas", label: "Dívidas relevantes (bancárias, fiscais, AT, SS)", type: "textarea", placeholder: "Dívida bancária: €200K. Dívida à AT: €15K. Suprimentos: €50K..." },
    { id: "fin_litigios", label: "Litígios pendentes", type: "textarea", placeholder: "Ação laboral pendente, execução fiscal, litígio com fornecedor..." },
    { id: "fin_penhoras", label: "Penhoras, arrestos, providências cautelares", type: "text", placeholder: "Penhora sobre quota do Sócio A pela AT..." },
  ]},
  { section: "G — Trabalhadores", icon: "👷", fields: [
    { id: "trab_total", label: "Número total de trabalhadores (por sociedade)", type: "text", placeholder: "Soc. 1: 15 trabalhadores. Soc. 2: 2 trabalhadores." },
    { id: "trab_afetos", label: "Trabalhadores afetos a negócios/estabelecimentos específicos", type: "textarea", placeholder: "12 afetos ao restaurante, 3 à gestão..." },
    { id: "trab_notas", label: "Notas (outsourcing, estágios, IRCT, litígios laborais)", type: "textarea", placeholder: "CCT do setor de restauração aplicável, 1 trabalhador de baixa..." },
  ]},
  { section: "H — Prazos, valores e restrições", icon: "📅", fields: [
    { id: "prazo_global", label: "Prazo pretendido para a operação", type: "text", placeholder: "Ex: 3 meses, até fim do ano fiscal, urgente..." },
    { id: "valor_operacao", label: "Valor aproximado da operação (se M&A)", type: "text", placeholder: "Ex: €500.000, a negociar, pré-acordado em €1M..." },
    { id: "valor_distribuicao", label: "Distribuição do preço (se aplicável)", type: "textarea", placeholder: "€300K quotas + €200K imóveis, ou preço global..." },
    { id: "restricoes_especificas", label: "Restrições específicas do cliente", type: "textarea", placeholder: "Não quer cisão, prefere neutralidade, quer manter controlo, etc." },
  ]},
];

// ── OPERAÇÕES VIEW ─────────────────────────────────────────────────────

function OperacoesView({ onNavigate }) {
  const [ops, setOps] = useState([]);
  useEffect(() => { setOps(loadOperacoes()); }, []);

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Operações M&A</h1>
        <p style={{ fontSize: 14, color: CL.gr, margin: "6px 0 0" }}>Reorganização societária, reestruturação de grupos, M&A</p>
      </div>
      <Btn v="accent" size="lg" onClick={() => onNavigate("op_nova")}>+ Nova Operação</Btn>
    </div>

    <Al type="legal" title="Módulo de análise jurídica avançada">
      Preencha o questionário estruturado com os dados do caso. A IA gera um relatório completo de reorganização societária com cenários, análise fiscal (a validar), riscos, passos de implementação e resumo executivo. Qualidade de parecer "50K". Todos os outputs são rascunhos para revisão por advogados séniores.
    </Al>

    {ops.length > 0 && <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Operações anteriores</div>
      {ops.map((op, i) => <Cd key={i} hover onClick={() => onNavigate("op_detalhe", op.id)} style={{ marginBottom: 12, cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: CL.d }}>{op.titulo || "Operação sem título"}</div>
            <div style={{ fontSize: 12, color: CL.gr, marginTop: 4 }}>{op.data ? fmtD(op.data) : ""} · {op.status || "Em análise"}</div>
          </div>
          <Badge t={op.status || "Draft"} type={op.status === "Concluída" ? "privacy" : "info"} />
        </div>
      </Cd>)}
    </div>}
  </div>;
}

// ── ANALYSIS RENDERER ──────────────────────────────────────────────────

function AnalysisRenderer({ text }) {
  if (!text) return null;
  return <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.8, color: CL.d }}>
    {text.split("\n").map((line, i) => {
      const t = line.trim();
      if (!t) return <br key={i} />;
      if (t.startsWith("# ")) return <h2 key={i} style={{ fontSize: 20, fontWeight: 700, margin: "24px 0 8px", fontFamily: "'Playfair Display',serif", color: CL.d }}>{t.replace(/^#+\s*/, "")}</h2>;
      if (t.startsWith("## ")) return <h3 key={i} style={{ fontSize: 17, fontWeight: 700, margin: "20px 0 6px", color: CL.d, borderBottom: "1px solid #E5E7EB", paddingBottom: 6 }}>{t.replace(/^#+\s*/, "")}</h3>;
      if (t.startsWith("### ")) return <h4 key={i} style={{ fontSize: 15, fontWeight: 600, margin: "16px 0 4px", color: CL.d }}>{t.replace(/^#+\s*/, "")}</h4>;
      if (t.startsWith("#### ")) return <h4 key={i} style={{ fontSize: 14, fontWeight: 600, margin: "12px 0 4px", color: "#374151" }}>{t.replace(/^#+\s*/, "")}</h4>;
      if (t.includes("A VALIDAR COM O FISCALISTA") || t.includes("A validar com o fiscalista")) return <div key={i} style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderLeft: "4px solid #EA580C", borderRadius: 6, padding: "10px 14px", margin: "8px 0", fontSize: 13, fontWeight: 600, color: "#9A3412" }}>⚠ {t.replace(/\*\*/g, "")}</div>;
      if (t.startsWith("**") && t.endsWith("**")) return <p key={i} style={{ fontWeight: 700, margin: "12px 0 4px" }}>{t.replace(/^\*\*|\*\*$/g, "")}</p>;
      if (t.startsWith("- ") || t.startsWith("* ")) return <p key={i} style={{ paddingLeft: 20, margin: "2px 0" }}>{t}</p>;
      if (t.startsWith("INFORMAÇÃO EM FALTA")) return <div key={i} style={{ background: "#FEF3C7", padding: "8px 12px", borderRadius: 6, color: "#92400E", fontWeight: 600, margin: "8px 0", borderLeft: "4px solid #F59E0B" }}>{t}</div>;
      if (t.startsWith("ASSUNÇÃO") || t.startsWith("ASSUNÇ")) return <div key={i} style={{ background: "#EFF6FF", padding: "8px 12px", borderRadius: 6, color: "#1E40AF", fontWeight: 500, fontStyle: "italic", margin: "8px 0", borderLeft: "4px solid #3B82F6" }}>{t}</div>;
      return <p key={i} style={{ margin: "4px 0" }}>{t}</p>;
    })}
  </div>;
}

// ── NOVA OPERAÇÃO ──────────────────────────────────────────────────────

function NovaOperacao({ onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [titulo, setTitulo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const upd = (id, v) => setForm(f => ({ ...f, [id]: v }));

  const filledFields = useMemo(() => {
    return OP_INTAKE_FIELDS.reduce((n, sec) => n + sec.fields.filter(f => form[f.id]?.toString().trim()).length, 0);
  }, [form]);

  const totalFields = OP_INTAKE_FIELDS.reduce((n, sec) => n + sec.fields.length, 0);

  // Per-section progress
  const sectionProgress = useMemo(() => {
    return OP_INTAKE_FIELDS.map(sec => {
      const filled = sec.fields.filter(f => form[f.id]?.toString().trim()).length;
      return { section: sec.section, filled, total: sec.fields.length, pct: Math.round((filled / sec.fields.length) * 100) };
    });
  }, [form]);

  const globalProgress = Math.round((filledFields / totalFields) * 100);

  const buildPrompt = () => {
    let prompt = "Gera o relatório completo de reorganização societária / estruturação de operação, com a estrutura obrigatória completa (11 secções + resumo executivo). Dados fornecidos pelo advogado:\n\n";
    OP_INTAKE_FIELDS.forEach(sec => {
      prompt += `## ${sec.section}\n`;
      sec.fields.forEach(f => {
        const val = form[f.id]?.toString().trim();
        if (val) prompt += `- ${f.label}: ${val}\n`;
        else prompt += `- ${f.label}: [NÃO FORNECIDO]\n`;
      });
      prompt += "\n";
    });
    prompt += "\nGera o relatório completo. Sê exaustivo, estruturado, com cenários, cruzamentos fiscais (sempre com caixa 'A VALIDAR COM O FISCALISTA'), e qualidade de parecer premium.";
    return prompt;
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setAnalysis("");
    setStep(2);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16000,
          system: SYSTEM_PROMPT_OPERACOES,
          messages: [{ role: "user", content: buildPrompt() }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${response.status}. Verifique que está a executar dentro do ambiente Claude.ai.`);
      }

      const data = await response.json();
      const text = data.content?.map(b => b.type === "text" ? b.text : "").join("\n") || "Sem resposta da API.";
      setAnalysis(text);

      const op = {
        id: "op_" + Date.now(),
        titulo: titulo || form.ctx_objetivo?.substring(0, 60) || "Operação sem título",
        data: new Date().toISOString(),
        status: "Concluída",
        form,
        analysis: text,
      };
      saveOperacao(op);
    } catch (e) {
      console.error("Erro API:", e);
      setError(e.message || "Erro ao contactar a API.");
    }
    setLoading(false);
  };

  const handleExportDocx = async () => {
    setDownloading(true);
    try {
      await generateReportDocx(titulo || form.ctx_objetivo || "Operação", analysis);
    } catch (e) {
      console.error("Erro DOCX:", e);
      alert("Erro ao gerar DOCX: " + e.message);
    }
    setDownloading(false);
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Nova Operação</h1>
        <p style={{ fontSize: 14, color: CL.gr, margin: "4px 0 0" }}>Questionário estruturado para análise</p>
      </div>
      <Btn v="ghost" onClick={onCancel}>✕</Btn>
    </div>

    <Steps steps={["Questionário", "Revisão", "Relatório"]} cur={step} />

    {/* STEP 0 — Questionário */}
    {step === 0 && <div>
      <Cd style={{ marginBottom: 16 }}>
        <Inp label="Título da operação" value={titulo} onChange={setTitulo} placeholder="Ex: Reorganização do Grupo Silva — Holding + Imobiliária" />
      </Cd>

      {/* Progress overview */}
      <Cd style={{ marginBottom: 16, background: "#FAFBFD" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: CL.d, marginBottom: 12 }}>Estado de preenchimento</div>
        <ProgressBar value={globalProgress} label="Global" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {sectionProgress.map((sp, i) => <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 4, background: sp.pct >= 100 ? "#F0FDF4" : sp.pct > 0 ? "#FFFBEB" : "#F9FAFB" }}>
            <span style={{ color: sp.pct >= 100 ? CL.gn : "#374151" }}>{sp.pct >= 100 ? "✓" : "○"} {sp.section.replace(/^[A-H]\s—\s/, "")}</span>
            <span style={{ fontWeight: 600, color: sp.pct >= 100 ? CL.gn : CL.gr }}>{sp.filled}/{sp.total}</span>
          </div>)}
        </div>
      </Cd>

      {OP_INTAKE_FIELDS.map((sec, si) => <Cd key={si} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontSize: 18 }}>{sec.icon}</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: CL.d }}>{sec.section}</div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: sectionProgress[si]?.pct >= 100 ? CL.gn : CL.gr }}>
              {sectionProgress[si]?.filled}/{sectionProgress[si]?.total}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sec.fields.map(f => <Inp key={f.id} label={f.label} value={form[f.id] || ""} onChange={v => upd(f.id, v)} placeholder={f.placeholder} type={f.type === "number" ? "number" : "text"} multiline={f.type === "textarea"} rows={3} />)}
        </div>
      </Cd>)}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <Btn v="secondary" onClick={onCancel}>Cancelar</Btn>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: CL.gr }}>{filledFields}/{totalFields} campos · {globalProgress}%</span>
          <Btn disabled={filledFields < 3} onClick={() => setStep(1)}>Rever dados →</Btn>
        </div>
      </div>
    </div>}

    {/* STEP 1 — Revisão */}
    {step === 1 && <div>
      <Al type="warning" title="Verificar antes de gerar o relatório">Confirme que os dados estão corretos. Campos em falta serão assinalados como "INFORMAÇÃO EM FALTA" no relatório. Quanto mais dados fornecer, melhor será a qualidade do relatório.</Al>

      <div style={{ marginTop: 16 }}>
        {OP_INTAKE_FIELDS.map((sec, si) => {
          const filled = sec.fields.filter(f => form[f.id]?.toString().trim());
          const missing = sec.fields.filter(f => !form[f.id]?.toString().trim());
          return <Cd key={si} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span>{sec.icon}</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: CL.d }}>{sec.section}</div>
              <div style={{ marginLeft: "auto" }}>
                <Badge t={`${filled.length}/${sec.fields.length}`} type={filled.length === sec.fields.length ? "privacy" : missing.length === sec.fields.length ? "block" : "warn"} />
              </div>
            </div>
            {filled.map(f => <div key={f.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8 }}>
              <span style={{ color: CL.gn, flexShrink: 0 }}>✓</span>
              <span style={{ color: CL.gr, minWidth: 200, flexShrink: 0 }}>{f.label}:</span>
              <span style={{ fontWeight: 500, color: CL.d, wordBreak: "break-word" }}>{form[f.id]}</span>
            </div>)}
            {missing.map(f => <div key={f.id} style={{ fontSize: 13, padding: "4px 0", display: "flex", gap: 8 }}>
              <span style={{ color: CL.am, flexShrink: 0 }}>—</span>
              <span style={{ color: CL.gr }}>{f.label}: não fornecido</span>
            </div>)}
          </Cd>;
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <Btn v="secondary" onClick={() => setStep(0)}>← Editar</Btn>
        <Btn v="accent" onClick={runAnalysis}>Gerar Relatório</Btn>
      </div>
    </div>}

    {/* STEP 2 — Relatório */}
    {step === 2 && <div>
      {loading && <Cd style={{ textAlign: "center", padding: "64px 32px" }}>
        <div style={{ display: "inline-block", width: 40, height: 40, border: "3px solid #E5E7EB", borderTop: `3px solid ${CL.g}`, borderRadius: "50%", animation: "atas-spin 1s linear infinite" }} />
        <style>{"@keyframes atas-spin{to{transform:rotate(360deg)}}"}</style>
        <p style={{ fontSize: 15, color: CL.d, marginTop: 20, fontWeight: 600 }}>A gerar relatório de reorganização societária...</p>
        <p style={{ fontSize: 13, color: CL.gr, marginTop: 8 }}>Análise de cenários, cruzamentos fiscais, implementação, riscos</p>
        <p style={{ fontSize: 12, color: CL.gr, marginTop: 4 }}>Isto pode demorar 30-60 segundos</p>
      </Cd>}

      {error && <div>
        <Al type="block" title="Erro na geração do relatório">{error}</Al>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <Btn v="secondary" onClick={() => setStep(1)}>← Voltar</Btn>
          <Btn v="accent" onClick={runAnalysis}>Tentar novamente</Btn>
        </div>
      </div>}

      {analysis && <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Relatório de Reorganização Societária</h2>
            <p style={{ fontSize: 12, color: CL.gr, margin: "4px 0 0" }}>Rascunho — para revisão por advogado sénior · {fmtD(new Date().toISOString())}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="accent" size="sm" onClick={handleExportDocx} disabled={downloading}>{downloading ? "A gerar..." : "Exportar DOCX"}</Btn>
            <Btn v="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(analysis); }}>Copiar</Btn>
          </div>
        </div>
        <Cd style={{ padding: 40, marginBottom: 24 }}><AnalysisRenderer text={analysis} /></Cd>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Btn v="secondary" onClick={onCancel}>Concluir</Btn>
          <Btn v="accent" onClick={onCancel}>Voltar às Operações</Btn>
        </div>
      </div>}
    </div>}
  </div>;
}

// ── OPERAÇÃO DETALHE ───────────────────────────────────────────────────

function OperacaoDetalhe({ opId, onBack }) {
  const [op, setOp] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const found = loadOperacoes().find(o => o.id === opId);
    if (found) setOp(found);
  }, [opId]);

  const handleExportDocx = async () => {
    if (!op?.analysis) return;
    setDownloading(true);
    try {
      await generateReportDocx(op.titulo || "Operação", op.analysis);
    } catch (e) {
      console.error("Erro DOCX:", e);
      alert("Erro ao gerar DOCX: " + e.message);
    }
    setDownloading(false);
  };

  if (!op) return <Cd><p style={{ color: CL.gr, textAlign: "center", padding: 40 }}>Operação não encontrada.</p><Btn v="secondary" onClick={onBack}>← Voltar</Btn></Cd>;

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>{op.titulo}</h1>
        <p style={{ fontSize: 13, color: CL.gr, margin: "4px 0 0" }}>{op.data ? fmtD(op.data) : ""}</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="accent" size="sm" onClick={handleExportDocx} disabled={downloading}>{downloading ? "..." : "Exportar DOCX"}</Btn>
        <Btn v="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(op.analysis || ""); }}>Copiar</Btn>
        <Btn v="ghost" onClick={onBack}>← Voltar</Btn>
      </div>
    </div>
    {op.analysis && <Cd style={{ padding: 40 }}><AnalysisRenderer text={op.analysis} /></Cd>}
  </div>;
}


// ── APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");
  const [opDetailId, setOpDetailId] = useState(null);

  const handleOpNavigate = (target, id) => {
    if (target === "op_nova") setView("op_nova");
    else if (target === "op_detalhe") { setOpDetailId(id); setView("op_detalhe"); }
  };

  return <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F1F3F5;color:#1F2937;-webkit-font-smoothing:antialiased}::selection{background:#B8976A33}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#B8976A!important;box-shadow:0 0 0 3px #B8976A18}`}</style>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={view === "op_nova" || view === "op_detalhe" ? "operacoes" : view} setActive={v => { setView(v); setOpDetailId(null); }} />
      <main style={{ flex: 1, padding: "32px 40px", maxHeight: "100vh", overflow: "auto" }}>
        {view === "wizard" ? <Wizard onCancel={() => setView("dashboard")} onDone={() => setView("dashboard")} /> :
          view === "sociedades" ? <SociedadesView /> :
          view === "operacoes" ? <OperacoesView onNavigate={handleOpNavigate} /> :
          view === "op_nova" ? <NovaOperacao onCancel={() => setView("operacoes")} onDone={() => setView("operacoes")} /> :
          view === "op_detalhe" && opDetailId ? <OperacaoDetalhe opId={opDetailId} onBack={() => setView("operacoes")} /> :
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}><div><h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Dashboard</h1><p style={{ fontSize: 14, color: CL.gr, margin: "6px 0 0" }}>Ferramentas de documentação societária e M&A</p></div><Btn v="accent" size="lg" onClick={() => setView("wizard")}>+ Nova Deliberação</Btn></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <Cd hover onClick={() => setView("wizard")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Deliberações</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: CL.d }}>Atas, pactos sociais, listas de sócios</div>
                  <div style={{ fontSize: 13, color: CL.gr, marginTop: 4 }}>Geração automatizada de documentação societária para Lda.</div>
                </Cd>
                <Cd hover onClick={() => setView("operacoes")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Operações M&A</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: CL.d }}>Reorganização societária e reestruturação</div>
                  <div style={{ fontSize: 13, color: CL.gr, marginTop: 4 }}>Relatório premium com cenários, análise fiscal, implementação</div>
                </Cd>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <Cd><div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Sociedades registadas</div><div style={{ fontSize: 32, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{loadSociedades().length}</div></Cd>
                <Cd><div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Operações</div><div style={{ fontSize: 32, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{loadOperacoes().length}</div></Cd>
              </div>
              <Al type="privacy" title="Arquitectura de segurança">Zero dados pessoais no servidor. Sócios anónimos. Placeholders nos documentos. Operações guardadas localmente.</Al>
            </div>}
      </main>
    </div>
  </>;
}
