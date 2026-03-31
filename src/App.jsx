import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════
// ATAS PRO v4 — Textos Reais · Placeholders · Upload de Pacto Social
// ═══════════════════════════════════════════════════════════════════════
// Linguagem extraída de 15 documentos reais da equipa jurídica
// Padrões: Adrenalina Deslumbrante, 4IN Bany, JB Holdings, Conceptual
// ═══════════════════════════════════════════════════════════════════════

// ── TEMPLATE ENGINE ─────────────────────────────────────────────────────
// Templates use the real language patterns from the firm's documents
// Personal data uses [PLACEHOLDER] format for local-only completion

const TEMPLATES = {

  // ── ATA: Preâmbulo ──
  ata_preambulo_plural: (soc, numSocios) => `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de dois mil e vinte e seis, pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede}, a Assembleia Geral Extraordinária da sociedade ${soc.tipo.toLowerCase()}, denominada "${soc.firma}", com o número único de matrícula e de identificação fiscal ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}).`,

  ata_preambulo_uni: (soc) => `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de dois mil e vinte e seis, pelas [HORA] horas, reuniu na sua sede social, sita em ${soc.sede}, em Assembleia Geral extraordinária da Sociedade ${soc.firma} (doravante apenas a "Sociedade"), registada na Conservatória do Registo Comercial sob o número único de matrícula e de identificação fiscal ${soc.nipc}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), totalmente realizado.`,

  // ── ATA: Identificação de sócios ──
  ata_socio_singular: (id) => `[NOME_SOCIO_${id}], [ESTADO_CIVIL_${id}], natural da freguesia de [NATURALIDADE_${id}], concelho de [CONCELHO_NAT_${id}], com o número de identificação fiscal [NIF_${id}], portador do Cartão de Cidadão número [CC_${id}], emitido pela República Portuguesa e válido até [CC_VALIDADE_${id}], residente em [MORADA_${id}]`,

  ata_socio_coletivo: (id) => `[FIRMA_SOCIO_${id}], sociedade por quotas, NIPC [NIPC_SOCIO_${id}], com sede em [SEDE_SOCIO_${id}], e com o capital social de [CAPITAL_SOCIO_${id}], neste ato representada pelo seu gerente [NOME_REPRESENTANTE_${id}], [ESTADO_CIVIL_REP_${id}], NIF [NIF_REP_${id}], portador do cartão de cidadão n.º [CC_REP_${id}], emitido pela República Portuguesa e válido até [CC_VALIDADE_REP_${id}], residente em [MORADA_REP_${id}]`,

  // ── ATA: Assembleia Universal ──
  ata_universal_plural: `Verificando-se estar reunida a totalidade do capital social e tendo sido dispensadas todas as formalidades prévias de convocação nos termos do artigo 54.º do Código das Sociedades Comerciais, assumiu a presidência da assembleia o sócio-gerente [NOME_PRESIDENTE], tendo ainda os sócios manifestado a sua vontade no sentido de que a assembleia se constituísse e deliberasse sobre a seguinte ordem de trabalhos:`,

  ata_universal_uni: `Estando representada a totalidade do capital social, o sócio único concordou em reunir e deliberar sem formalidades prévias, nos termos do artigo 54.º do Código das Sociedades Comerciais, sobre os assuntos que constituem a seguinte ordem de trabalhos:`,

  // ── ATA: Encerramento ──
  ata_encerramento_plural: `Nada mais havendo a tratar, foi encerrada a sessão pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelos sócios, em sinal de conformidade.`,
  ata_encerramento_uni: `Não havendo outros assuntos a tratar, foi encerrada a assembleia pelas [HORA_FIM] horas e lavrada a presente ata, que depois de lida e aprovada vai ser assinada pelo sócio presente.`,

  // ── DELIBERAÇÕES ──
  delib_cessao: (soc, fd) => `Entrou-se de imediato na discussão do Ponto [N] da Ordem de Trabalhos, tendo sido comunicado pelo sócio a cessão de quotas, efetuada por contrato particular, tendo sido cedida a quota do sócio [NOME_CEDENTE], com o valor nominal de ${fd.ces_vn ? fmt(Number(fd.ces_vn)) : "[VALOR]"}, correspondente a [PERCENTAGEM]% do capital da sociedade, a [NOME_CESSIONARIO].

Em conformidade com o disposto no artigo 228.º n.º 2 do Código das Sociedades Comerciais, a referida cessão de quotas encontra-se ${fd.ces_consentimento_exigido === "nao" ? "dispensada de consentimento da sociedade, por se tratar de negócio celebrado entre sócios" : "sujeita ao consentimento da sociedade, o qual foi deliberado e concedido por unanimidade"}.`,

  delib_aumento_dinheiro: (soc, fd) => {
    const montante = Number(fd.aum_montante) || 0;
    const novoCap = (soc?.capital || 0) + montante;
    return `De seguida, entrou-se no Ponto [N] da ordem de trabalhos. ${soc.socios.length === 1 ? "O sócio apresentou" : "Foi apresentado"} um conjunto de considerações sobre a necessidade de serem reforçados os capitais próprios da sociedade e que a melhor forma de tal propósito ser concretizado seria através de um aumento de capital, na modalidade de novas entradas, a subscrever em numerário ${fd.aum_sub === "dinheiro_socios" ? "pelo(s) atual(is) sócio(s)" : ""}. Assim, ${soc.socios.length === 1 ? "o sócio concorda" : "os sócios concordam"} que o reforço no montante de ${fmt(montante)} (${extenso(montante)}) ${montante > 0 ? `eleva o capital social de ${fmt(soc.capital)} para ${fmt(novoCap)} (${extenso(novoCap)})` : "[DEFINIR]"}.

${soc.socios.length === 1 ? "O sócio e gerente declara" : "Os sócios declaram"}, nos termos e para os efeitos do artigo 88.º do Código das Sociedades Comerciais (CSC), que ${fd.aum_realizacao_integral === "sim" ? "a entrada em numerário já foi realizada, encontrando-se o respetivo valor depositado nos cofres da Sociedade" : "as entradas serão realizadas no prazo de [PRAZO_REALIZACAO]"}, não sendo exigida pela lei ou pelos estatutos da Sociedade a realização de outras entradas.`;
  },

  delib_alteracao_sede: (soc, fd) => `Foi ainda deliberado e aprovado a alteração da sede da sociedade para: "${fd.novo_texto || "[NOVA_SEDE]"}".`,

  delib_alteracao_firma: (soc, fd) => `Foi deliberado e aprovado, por unanimidade, a alteração da firma da sociedade, que passa a ser: "${fd.novo_texto || "[NOVA_FIRMA]"}". ${fd.cert_admissibilidade ? `O certificado de admissibilidade de firma n.º [N_CERTIFICADO], emitido pelo RNPC, encontra-se válido.` : ""}`,

  delib_nomeacao_gerente: () => `Foi proposto e aprovado por unanimidade a nomeação de [NOME_GERENTE_NOVO], [ESTADO_CIVIL_GERENTE], NIF [NIF_GERENTE_NOVO], residente em [MORADA_GERENTE_NOVO], para o cargo de gerente da sociedade. O nomeado declara aceitar o cargo para que foi eleito e encontra-se em plenas condições para o exercício das funções, não se verificando qualquer situação de incompatibilidade ou impedimento.`,

  delib_destituicao_gerente: (soc, fd) => `Foi proposto e deliberado por ${fd.dest_justa_causa === "sim" ? "maioria" : "unanimidade"} a destituição de [NOME_GERENTE_DESTITUIDO] do cargo de gerente da sociedade${fd.dest_justa_causa === "sim" ? ", com justa causa, com fundamento em [FUNDAMENTO_JUSTA_CAUSA]" : ""}.${fd.dest_justa_causa !== "sim" ? " A destituição opera sem invocação de justa causa, ficando ressalvado o direito a eventual indemnização nos termos legais." : ""}`,

  delib_alteracao_pacto: (soc) => `Por fim, iniciou-se o Ponto [N] da Ordem de Trabalhos, tendo ${soc.socios.length === 1 ? "o sócio" : "os sócios"} deliberado e votado aprovar a nova redação do pacto social. Neste sentido, ${soc.socios.length === 1 ? "o sócio apresentou" : "foi apresentado"} o novo pacto social, que passa a ter a seguinte redação:`,

  delib_dissolucao: (soc, fd) => `Foi deliberado, por unanimidade, a dissolução da sociedade, ao abrigo do artigo 141.º, n.º 1, alínea b) do Código das Sociedades Comerciais${fd.dis_fund ? `, com o seguinte fundamento: ${fd.dis_fund}` : ""}. A firma da sociedade passa a incluir a menção "em liquidação", nos termos legais.`,

  delib_aprovacao_contas: (soc, fd) => `Foi apresentado e posto à discussão o balanço, a demonstração de resultados e demais documentos de prestação de contas referentes ao exercício de ${fd.ct_exercicio || "[ANO]"}, tendo ${soc.socios.length === 1 ? "o sócio deliberado" : "os sócios deliberado por unanimidade"} ${fd.ct_decisao === "aprovadas" ? "aprovar" : "não aprovar"} as contas do exercício, que apresentam um resultado líquido de ${fd.ct_resultado ? fmt(Number(fd.ct_resultado)) : "[VALOR]"}.`,

  delib_distribuicao_lucros: (soc, fd) => `Foi deliberado proceder à distribuição de resultados do exercício no montante de ${fd.dl_total ? fmt(Number(fd.dl_total)) : "[VALOR]"}, na proporção das respetivas participações sociais.`,

  // ── LISTA DE SÓCIOS ──
  lista_socios: (soc) => `LISTA DE SÓCIOS

${soc.firma}, ${soc.tipo.toLowerCase()}, com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com sede em ${soc.sede}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), representado pela${soc.socios.length > 1 ? "s seguintes quotas" : " seguinte quota"}:

${soc.socios.map((s, i) => `${String.fromCharCode(97 + i)}) Uma quota com o valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), representativa de ${s.pct}% da totalidade do capital social, pertencente a [NOME_SOCIO_${s.id}], [ESTADO_CIVIL_${s.id}], natural de [NATURALIDADE_${s.id}], NIF [NIF_${s.id}], portador do CC n.º [CC_${s.id}], emitido pela República Portuguesa e válido até [CC_VALIDADE_${s.id}], residente em [MORADA_${s.id}].`).join("\n\n")}

[LOCAL], [DATA]

O${soc.socios.length > 1 ? "s Sócios" : " Sócio"}`,

  // ── CONTRATO DE CESSÃO ──
  contrato_cessao_capa: (soc, fd) => `CONTRATO DE CESSÃO DE QUOTAS

Relativo a uma quota representativa de [PERCENTAGEM]% do capital social da ${soc.tipo.toLowerCase()}
"${soc.firma}"

ENTRE
[NOME_CEDENTE]
como cedente

E
[NOME_CESSIONARIO]
como cessionári${fd.ces_cessionario_genero === "f" ? "a" : "o"}

[LOCAL], [DATA]`,

};

// ── UTILITIES ───────────────────────────────────────────────────────────

const fmt = v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
const fmtD = d => new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });

function extenso(v) {
  if (!v || isNaN(v)) return "[por extenso]";
  const n = Number(v);
  if (n === 0) return "zero euros";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"];
  const tens = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function toWords(num) {
    if (num === 0) return "";
    if (num === 100) return "cem";
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) { const t = tens[Math.floor(num / 10)]; const u = num % 10; return u ? `${t} e ${units[u]}` : t; }
    if (num < 1000) { const h = hundreds[Math.floor(num / 100)]; const r = num % 100; return r ? `${h} e ${toWords(r)}` : (num === 100 ? "cem" : h); }
    if (num < 1000000) {
      const th = Math.floor(num / 1000); const r = num % 1000;
      const thW = th === 1 ? "mil" : `${toWords(th)} mil`;
      return r ? (r < 100 ? `${thW} e ${toWords(r)}` : `${thW} ${toWords(r)}`) : thW;
    }
    return `${toWords(Math.floor(n))} euros`;
  }
  const cents = Math.round((n % 1) * 100);
  let result = toWords(Math.floor(n)) + " euros";
  if (cents > 0) result += ` e ${toWords(cents)} cêntimos`;
  return result;
}

// ── CONFIG ──────────────────────────────────────────────────────────────

const DELIB_TYPES = [
  { id:"aumento_capital", label:"Aumento de Capital", icon:"↑", cat:"capital", pacto:true, lista:true, registo:true, rcbe:true, maioria:true },
  { id:"suprimentos", label:"Suprimentos", icon:"§", cat:"capital", pacto:false, lista:false, registo:false, rcbe:false },
  { id:"prestacoes_suplementares", label:"Prestações Suplementares", icon:"±", cat:"capital", pacto:"cond", lista:false, registo:"cond", rcbe:false },
  { id:"cessao_quotas", label:"Cessão de Quotas", icon:"⇄", cat:"quotas", pacto:false, lista:true, registo:true, rcbe:true },
  { id:"amortizacao", label:"Amortização de Quotas", icon:"✕", cat:"quotas", pacto:"cond", lista:true, registo:true, rcbe:true },
  { id:"exclusao_exoneracao", label:"Exclusão / Exoneração", icon:"⊘", cat:"socios", pacto:false, lista:true, registo:true, rcbe:true },
  { id:"alteracao_firma", label:"Alteração de Firma", icon:"A", cat:"pacto", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"alteracao_sede", label:"Alteração de Sede", icon:"⌂", cat:"pacto", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"alteracao_objeto", label:"Alteração de Objeto", icon:"◈", cat:"pacto", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"alteracao_forma_obrigar", label:"Forma de Obrigar", icon:"⊡", cat:"pacto", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"aprovacao_contas", label:"Aprovação de Contas", icon:"✓", cat:"contas", pacto:false, lista:false, registo:false, rcbe:false },
  { id:"distribuicao_lucros", label:"Distribuição de Lucros", icon:"€", cat:"contas", pacto:false, lista:false, registo:false, rcbe:false },
  { id:"distribuicao_reservas", label:"Distribuição de Reservas", icon:"R", cat:"contas", pacto:false, lista:false, registo:false, rcbe:false },
  { id:"dissolucao", label:"Dissolução", icon:"⊗", cat:"vida", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"nomeacao_liquidatarios", label:"Nomeação de Liquidatários", icon:"⊕", cat:"vida", pacto:false, lista:false, registo:true, rcbe:false },
  { id:"contas_liquidacao", label:"Contas de Liquidação", icon:"☐", cat:"vida", pacto:false, lista:false, registo:true, rcbe:false },
  { id:"regresso_atividade", label:"Regresso à Atividade", icon:"↻", cat:"vida", pacto:true, lista:false, registo:true, rcbe:false, maioria:true },
  { id:"nomeacao_gerente", label:"Nomeação de Gerente", icon:"⊞", cat:"gerencia", pacto:false, lista:false, registo:true, rcbe:false },
  { id:"destituicao_gerente", label:"Destituição de Gerente", icon:"⊟", cat:"gerencia", pacto:false, lista:false, registo:true, rcbe:false },
  { id:"outra", label:"Outra Deliberação", icon:"…", cat:"outros", pacto:false, lista:false, registo:false, rcbe:false },
];

const CATS = { capital:"Estrutura de Capital", quotas:"Quotas", socios:"Sócios", pacto:"Pacto Social", contas:"Contas e Resultados", vida:"Vida da Sociedade", gerencia:"Gerência", outros:"Outros" };

const AUM_SUBS = [
  {id:"dinheiro_socios",l:"Entradas em dinheiro — só sócios"},
  {id:"dinheiro_novos",l:"Entradas em dinheiro — com novos sócios"},
  {id:"dinheiro_renuncia",l:"Renúncia/limitação do direito de preferência"},
  {id:"reservas",l:"Incorporação de reservas"},
  {id:"conversao_assembleia",l:"Conversão de suprimentos — assembleia"},
  {id:"conversao_unilateral",l:"Conversão unilateral por sócio maioritário"},
  {id:"especie",l:"Entradas em espécie"},
];

const CESSAO_SUBS = [
  {id:"socios_familia",l:"Entre sócios ou família"},
  {id:"terceiro_consentimento",l:"A terceiro com consentimento"},
  {id:"recusa_amortizacao",l:"Recusa com amortização"},
  {id:"recusa_aquisicao",l:"Recusa com aquisição"},
];

const STATUS = { rascunho:{l:"Rascunho",c:"#6B7280"}, pronto:{l:"Pronto",c:"#D97706"}, revisto:{l:"Revisto",c:"#2563EB"}, concluido:{l:"Concluído",c:"#059669"} };

const SOCIEDADES = [
  { id:"s1", firma:"TechLaw Solutions, Lda.", nipc:"516 234 567", sede:"Rua Augusta, 45, 3.º Dto., 1100-048 Lisboa", tipo:"Sociedade por Quotas", capital:50000, objeto:"Consultoria jurídica e tecnológica.", formaObrigar:"A sociedade obriga-se com a intervenção de um gerente.", numGerentes:2,
    socios:[{id:"A",quota:25000,pct:50,penhor:false,usufruto:false},{id:"B",quota:15000,pct:30,penhor:false,usufruto:false},{id:"C",quota:10000,pct:20,penhor:false,usufruto:false}], maioriaContratual:null },
  { id:"s2", firma:"Construções Ribeiro & Filhos, Lda.", nipc:"509 876 543", sede:"Av. da República, 120, 4000-380 Porto", tipo:"Sociedade por Quotas", capital:100000, objeto:"Construção civil e promoção imobiliária.", formaObrigar:"A sociedade obriga-se com a intervenção conjunta de dois gerentes.", numGerentes:1,
    socios:[{id:"A",quota:60000,pct:60,penhor:false,usufruto:false},{id:"B",quota:40000,pct:40,penhor:true,usufruto:false}], maioriaContratual:null },
  { id:"s3", firma:"Digital Porto, Unipessoal Lda.", nipc:"517 111 222", sede:"Praça do Marquês, 8, 4000-390 Porto", tipo:"Sociedade Unipessoal por Quotas", capital:5000, objeto:"Desenvolvimento de software.", formaObrigar:"A sociedade obriga-se com a intervenção de um gerente.", numGerentes:1,
    socios:[{id:"A",quota:5000,pct:100,penhor:false,usufruto:false}], maioriaContratual:null },
];

// ── VALIDATION ENGINE (from v3 — unchanged) ─────────────────────────────

function validate(did, fd, soc) {
  const B=[], W=[], I=[];
  if (!soc) return {B,W,I};
  const dt=DELIB_TYPES.find(d=>d.id===did);
  if (dt?.maioria) {
    const req=soc.maioriaContratual||75, v=Number(fd.votosAFavor)||0;
    if (v>0&&v<req) B.push(`Maioria insuficiente: ${v}% < ${req}% exigido (art. 265.º CSC).`);
    if (!fd.votosAFavor) W.push("Indicar percentagem de votos favoráveis.");
  }
  if (did==="aumento_capital") {
    if (fd.aum_anterior_pendente==="sim") B.push("Aumento anterior não definitivamente registado — bloqueado (art. 87.º, n.º 3 CSC).");
    if (fd.aum_prestacoes_falta==="sim"&&["dinheiro_socios","dinheiro_novos","dinheiro_renuncia","especie"].includes(fd.aum_sub)) B.push("Prestações de capital vencidas em falta — bloqueado (art. 87.º, n.º 4 CSC).");
    if (fd.aum_sub==="dinheiro_renuncia") W.push("ALERTA: Renúncia ao direito de preferência — art. 266.º CSC.");
    if (fd.aum_sub==="reservas") { if (fd.aum_contas_6meses==="nao"&&fd.aum_balanco_especial!=="sim") B.push("Contas >6 meses sem balanço especial — bloqueado (art. 91.º, n.º 2 CSC)."); }
    if (fd.aum_sub?.startsWith("conversao")&&fd.aum_declaracao_cc!=="sim") B.push("Falta declaração CC/ROC — bloqueado.");
    if (fd.aum_realizacao_integral==="nao") W.push("Entradas não realizadas integralmente.");
    I.push("Art. 87.º CSC: deliberação deve conter modalidade, montante, participações e prazos.");
  }
  if (did==="cessao_quotas") {
    if (fd.ces_consentimento_exigido==="sim"&&fd.ces_consentimento_dado!=="sim") B.push("Consentimento exigido mas não concedido — cessão ineficaz (art. 228.º CSC).");
    if (fd.ces_tipo==="parcial") W.push("Cessão parcial exige consentimento para divisão (art. 221.º CSC).");
    const socio=soc.socios.find(s=>s.id===fd.ces_socio);
    if (socio?.penhor) W.push("Quota com penhor — notificação ao credor pignoratício.");
    if (socio?.usufruto) W.push("Quota com usufruto — verificar direitos do usufrutuário.");
    I.push("Art. 228.º CSC: forma escrita obrigatória.");
  }
  if (did==="amortizacao") {
    if (fd.amort_liberada!=="sim"&&fd.amort_sub!=="com_reducao") B.push("Quota não liberada sem redução — bloqueado (art. 232.º CSC).");
    const socio=soc.socios.find(s=>s.id===fd.amort_socio);
    if (socio?.penhor) W.push("ALERTA: quota com penhor.");
  }
  if (did==="exclusao_exoneracao") {
    if (fd.excl_sub==="exclusao"&&fd.excl_contraditorio!=="sim") W.push("Exclusão sem contraditório — altamente litigioso.");
    if (!fd.excl_destino_quota) B.push("Destino da quota não definido — bloqueado.");
    if (fd.excl_socio_votou==="sim"&&fd.excl_sub==="exclusao") W.push("Sócio visado votou na própria exclusão — art. 251.º CSC.");
  }
  if (did==="prestacoes_suplementares") {
    if (fd.ps_sub==="criacao"&&!fd.ps_montante_max) B.push("Montante global máximo obrigatório — bloqueado.");
    if (fd.ps_sub==="chamada"&&Number(fd.ps_prazo_dias||0)<30) B.push("Prazo <30 dias — bloqueado.");
  }
  if (did==="dissolucao") I.push("Firma passará a conter 'em liquidação'. Dissolução exige registo.");
  if (did==="regresso_atividade") {
    if (fd.ra_passivo_pago!=="sim") B.push("Passivo não pago — bloqueado.");
    if (fd.ra_causa_subsiste==="sim") B.push("Causa de dissolução subsiste — bloqueado.");
  }
  return {B,W,I};
}

function computeEffects(selDel, fdMap, soc) {
  const fx={pacto:false,lista:false,registo:false,rcbe:false}; const docs=new Set(["Ata"]);
  selDel.forEach(did=>{
    const dt=DELIB_TYPES.find(d=>d.id===did); if(!dt)return; const fd=fdMap[did]||{};
    if(dt.pacto===true)fx.pacto=true; if(dt.pacto==="cond"&&(did==="prestacoes_suplementares"&&fd.ps_sub==="criacao"||did==="amortizacao"&&fd.amort_sub==="com_reducao"))fx.pacto=true;
    if(dt.lista===true)fx.lista=true; if(dt.registo===true||(dt.registo==="cond"&&fx.pacto))fx.registo=true; if(dt.rcbe===true)fx.rcbe=true;
    if(fx.pacto)docs.add("Pacto Social Atualizado"); if(fx.lista){docs.add("Lista de Sócios");docs.add("Mapa de Quotas");}
    if(fx.rcbe)docs.add("Atualização RCBE"); if(fx.registo)docs.add("Requerimento de Registo");
    if(did==="aumento_capital"){docs.add("Declaração de Entradas");docs.add("Declaração CC/ROC");} if(did==="cessao_quotas")docs.add("Contrato de Cessão");
    if(did==="amortizacao")docs.add("Documento de Amortização"); if(did==="nomeacao_gerente")docs.add("Aceitação de Gerente");
    if(did==="dissolucao"||did==="nomeacao_liquidatarios")docs.add("Aceitação de Liquidatário"); if(did==="suprimentos")docs.add("Contrato de Suprimento");
    if(did==="aprovacao_contas")docs.add("Depósito de Contas"); if(did==="distribuicao_lucros")docs.add("Recibos de Dividendos");
    if(did==="exclusao_exoneracao")docs.add("Comunicação ao Sócio");
  });
  return {fx,docs:Array.from(docs)};
}

// ── UI PRIMITIVES ───────────────────────────────────────────────────────

const C={d:"#0F172A",g:"#B8976A",gr:"#6B7280",r:"#DC2626",gn:"#059669",bl:"#2563EB",am:"#D97706"};

function Badge({t,type}){const m={pacto:{bg:"#FEF3C7",c:"#92400E",i:"◆"},lista:{bg:"#DBEAFE",c:"#1E40AF",i:"☰"},registo:{bg:"#FCE7F3",c:"#9D174D",i:"⬡"},rcbe:{bg:"#F3E8FF",c:"#6B21A8",i:"◎"},block:{bg:"#FEE2E2",c:"#991B1B",i:"⛔"},warn:{bg:"#FFFBEB",c:"#92400E",i:"⚠"},info:{bg:"#EFF6FF",c:"#1E40AF",i:"ℹ"},legal:{bg:"#FDF8F0",c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",c:"#166534",i:"🔒"}}[type]||{bg:"#F3F4F6",c:"#374151",i:"•"};return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,background:m.bg,color:m.c}}>{m.i} {t}</span>}

function SB({s}){const v=STATUS[s];return <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:4,fontSize:11,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",background:v.c+"14",color:v.c}}><span style={{width:6,height:6,borderRadius:"50%",background:v.c}}/>{v.l}</span>}

function Cd({children,style,onClick,hover}){const[h,sH]=useState(false);return<div onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:24,transition:"all 0.2s",cursor:onClick?"pointer":"default",...(hover&&h?{borderColor:C.g,boxShadow:"0 4px 12px rgba(184,151,106,0.12)"}:{}),...style}}>{children}</div>}

function Inp({label,value,onChange,placeholder,type="text",required,disabled,eph,style:sx}){return<div style={{display:"flex",flexDirection:"column",gap:6,...sx}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:C.g}}> *</span>}{eph&&<span style={{fontSize:9,color:C.gn,fontWeight:600,background:"#ECFDF5",padding:"1px 6px",borderRadius:3,marginLeft:6}}>placeholder</span>}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{padding:"10px 14px",border:`1px solid ${eph?"#A7F3D0":"#D1D5DB"}`,borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#1F2937",background:disabled?"#F9FAFB":eph?"#F0FDF9":"#fff",outline:"none"}} onFocus={e=>e.target.style.borderColor=C.g} onBlur={e=>e.target.style.borderColor=eph?"#A7F3D0":"#D1D5DB"}/></div>}

function Sel({label,value,onChange,options,required,placeholder}){return<div style={{display:"flex",flexDirection:"column",gap:6}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:C.g}}> *</span>}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{padding:"10px 14px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:value?"#1F2937":"#9CA3AF",background:"#fff",outline:"none",cursor:"pointer"}}><option value="">{placeholder||"Selecionar..."}</option>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select></div>}

function Rad({label,value,onChange,options,required}){return<div style={{display:"flex",flexDirection:"column",gap:8}}>{label&&<label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:C.g}}> *</span>}</label>}<div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{options.map(o=><div key={o.v} onClick={()=>onChange(o.v)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:6,cursor:"pointer",border:value===o.v?`2px solid ${C.d}`:"1px solid #D1D5DB",background:value===o.v?"#F0F4FF":"#fff",fontSize:13,fontWeight:value===o.v?600:400}}><div style={{width:16,height:16,borderRadius:"50%",border:value===o.v?"none":"2px solid #D1D5DB",background:value===o.v?C.d:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{value===o.v&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}</div>{o.l}</div>)}</div></div>}

function Btn({children,onClick,v="primary",size="md",disabled,style:sx}){const s={primary:{bg:C.d,c:"#fff",b:"none"},secondary:{bg:"#fff",c:C.d,b:"1px solid #D1D5DB"},accent:{bg:C.g,c:"#fff",b:"none"},ghost:{bg:"transparent",c:C.gr,b:"none"}}[v];return<button onClick={onClick} disabled={disabled} style={{padding:size==="sm"?"8px 16px":size==="lg"?"14px 28px":"10px 20px",borderRadius:6,fontSize:size==="sm"?12:size==="lg"?15:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:8,background:disabled?"#E5E7EB":s.bg,color:disabled?"#9CA3AF":s.c,border:s.b||"none",opacity:disabled?0.7:1,...sx}}>{children}</button>}

function Al({type,title,children}){const m={info:{bg:"#EFF6FF",b:"#3B82F6",c:"#1E40AF",i:"ℹ"},warning:{bg:"#FFFBEB",b:"#F59E0B",c:"#92400E",i:"⚠"},block:{bg:"#FEE2E2",b:"#EF4444",c:"#991B1B",i:"⛔"},legal:{bg:"#FDF8F0",b:C.g,c:"#78582A",i:"§"},privacy:{bg:"#ECFDF5",b:C.gn,c:"#166534",i:"🔒"},success:{bg:"#F0FDF4",b:"#22C55E",c:"#166534",i:"✓"}}[type];return<div style={{display:"flex",gap:14,padding:16,borderRadius:8,background:m.bg,borderLeft:`3px solid ${m.b}`}}><span style={{fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>{m.i}</span><div>{title&&<div style={{fontSize:13,fontWeight:600,color:m.c,marginBottom:4}}>{title}</div>}<div style={{fontSize:13,color:m.c,lineHeight:1.5}}>{children}</div></div></div>}

function Steps({steps,cur}){return<div style={{display:"flex",alignItems:"center",padding:"0 0 32px"}}>{steps.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:i<=cur?C.d:"#E5E7EB",color:i<=cur?"#fff":"#9CA3AF"}}>{i<cur?"✓":i+1}</div><span style={{fontSize:13,fontWeight:i===cur?600:400,color:i<=cur?C.d:"#9CA3AF",whiteSpace:"nowrap"}}>{s}</span></div>{i<steps.length-1&&<div style={{flex:1,height:2,margin:"0 16px",background:i<cur?C.d:"#E5E7EB"}}/>}</div>)}</div>}

// ── PLACEHOLDER HIGHLIGHT ───────────────────────────────────────────────

function DocText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\[[A-Z_]+(?:_[A-Z0-9]+)*\])/g);
  return <>{parts.map((p, i) =>
    p.startsWith("[") && p.endsWith("]")
      ? <span key={i} style={{ background: "#FEF3C7", color: "#92400E", padding: "1px 4px", borderRadius: 3, fontWeight: 600, fontSize: "0.95em", fontFamily: "monospace" }}>{p}</span>
      : <span key={i}>{p}</span>
  )}</>;
}

// ── SIDEBAR ─────────────────────────────────────────────────────────────

function Sidebar({active,setActive}){
  const nav=[{id:"dashboard",l:"Dashboard",i:"⊞"},{id:"wizard",l:"Nova Deliberação",i:"+"},{id:"sociedades",l:"Sociedades",i:"◈"}];
  return<div style={{width:260,minHeight:"100vh",background:C.d,display:"flex",flexDirection:"column",flexShrink:0}}>
    <div style={{padding:"28px 24px 24px",borderBottom:"1px solid #1E293B"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${C.g},#D4B88C)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:C.d}}>§</div><div><div style={{fontSize:17,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.02em",fontFamily:"'Playfair Display',serif"}}>ATAS PRO</div><div style={{fontSize:10,color:"#64748B",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:500}}>v4 · Textos Reais</div></div></div></div>
    <nav style={{padding:"16px 12px",flex:1}}>{nav.map(n=><button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontWeight:active===n.id?600:400,fontFamily:"'DM Sans',sans-serif",marginBottom:4,background:active===n.id?"#1E293B":"transparent",color:active===n.id?"#F1F5F9":"#94A3B8"}}><span style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:active===n.id?C.g+"22":"transparent",color:active===n.id?C.g:"#64748B"}}>{n.i}</span>{n.l}</button>)}</nav>
    <div style={{padding:"16px 24px 24px",borderTop:"1px solid #1E293B"}}><div style={{fontSize:10,color:C.gn,fontWeight:500}}>🔒 Zero dados pessoais no servidor</div><div style={{fontSize:10,color:"#475569",marginTop:4}}>Sócios anónimos · [PLACEHOLDERS] nos docs</div></div>
  </div>;
}

// ── DOCUMENT PREVIEW (Real templates) ───────────────────────────────────

function AtaPreview({ soc, selDel, fdMap }) {
  if (!soc) return null;
  const isUni = soc.socios.length === 1;
  const preambulo = isUni ? TEMPLATES.ata_preambulo_uni(soc) : TEMPLATES.ata_preambulo_plural(soc);
  const universal = isUni ? TEMPLATES.ata_universal_uni : TEMPLATES.ata_universal_plural;
  const encerramento = isUni ? TEMPLATES.ata_encerramento_uni : TEMPLATES.ata_encerramento_plural;

  const pontoLabels = selDel.map(did => {
    const dt = DELIB_TYPES.find(d => d.id === did);
    return dt?.label || "[Deliberação]";
  });

  const pontosNumerados = ["Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito"];

  return (
    <div style={{ fontFamily: "'Times New Roman', serif", fontSize: 13, lineHeight: 2, color: "#1F2937", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ATA N.º [NÚMERO]
        </h2>
      </div>

      <p><DocText text={preambulo} /></p>

      <p style={{ marginTop: 16 }}>
        <DocText text={isUni ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:"} />
      </p>

      {soc.socios.map((s, i) => (
        <p key={i} style={{ paddingLeft: 20 }}>
          <DocText text={`${String.fromCharCode(97 + i)}) ${TEMPLATES.ata_socio_singular(s.id)}, titular de uma quota no valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`} />
        </p>
      ))}

      <p style={{ marginTop: 16 }}><DocText text={universal} /></p>

      {selDel.map((did, i) => (
        <p key={did} style={{ paddingLeft: 0, fontWeight: 600 }}>
          Ponto {pontosNumerados[i] || (i + 1)}: <DocText text={`${getOrdemDiaText(did, fdMap[did] || {})}`} />
        </p>
      ))}

      {selDel.map((did, idx) => {
        const fd = fdMap[did] || {};
        return (
          <div key={did} style={{ marginTop: 24 }}>
            <p style={{ fontWeight: 600 }}>
              <DocText text={`Entrou-se ${idx === 0 ? "de imediato" : "seguidamente"} na discussão do Ponto ${pontosNumerados[idx] || (idx + 1)} da Ordem de Trabalhos.`} />
            </p>
            <p><DocText text={getDelibText(did, soc, fd)} /></p>
          </div>
        );
      })}

      {selDel.some(d => DELIB_TYPES.find(dt => dt.id === d)?.pacto === true) && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontWeight: 600 }}><DocText text={TEMPLATES.delib_alteracao_pacto(soc)} /></p>
          <p style={{ fontStyle: "italic", color: C.gr }}>[INSERIR NOVO PACTO SOCIAL CONSOLIDADO]</p>
        </div>
      )}

      <p style={{ marginTop: 32 }}><DocText text={encerramento} /></p>

      <div style={{ marginTop: 48 }}>
        {soc.socios.map((s, i) => (
          <div key={i} style={{ marginTop: 32, paddingTop: 8 }}>
            <div style={{ borderTop: "1px solid #374151", width: 250, marginBottom: 4 }} />
            <DocText text={`[NOME_SOCIO_${s.id}]`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function getOrdemDiaText(did, fd) {
  const map = {
    aumento_capital: "Deliberar sobre o aumento do capital social da sociedade.",
    cessao_quotas: "Informar sobre a cessão de quotas.",
    alteracao_firma: "Deliberar sobre a alteração da firma da sociedade.",
    alteracao_sede: "Deliberar sobre a alteração da sede da sociedade.",
    alteracao_objeto: "Deliberar sobre a alteração do objeto social.",
    alteracao_forma_obrigar: "Deliberar sobre a alteração da forma de obrigar a sociedade.",
    aprovacao_contas: `Deliberar sobre a aprovação das contas do exercício de ${fd.ct_exercicio || "[ANO]"}.`,
    distribuicao_lucros: "Deliberar sobre a distribuição de lucros.",
    distribuicao_reservas: "Deliberar sobre a distribuição de reservas.",
    dissolucao: "Deliberar sobre a dissolução da sociedade.",
    nomeacao_gerente: "Deliberar sobre a nomeação de gerente.",
    destituicao_gerente: "Deliberar sobre a destituição de gerente.",
    nomeacao_liquidatarios: "Deliberar sobre a nomeação de liquidatários.",
    suprimentos: "Deliberar sobre suprimentos à sociedade.",
    prestacoes_suplementares: "Deliberar sobre prestações suplementares.",
    amortizacao: "Deliberar sobre a amortização de quotas.",
    exclusao_exoneracao: `Deliberar sobre a ${fd.excl_sub === "exclusao" ? "exclusão" : "exoneração"} de sócio.`,
    regresso_atividade: "Deliberar sobre o regresso à atividade.",
  };
  return map[did] || "Deliberar sobre a alteração e atualização do pacto social.";
}

function getDelibText(did, soc, fd) {
  if (did === "cessao_quotas") return TEMPLATES.delib_cessao(soc, fd);
  if (did === "aumento_capital") return TEMPLATES.delib_aumento_dinheiro(soc, fd);
  if (did === "alteracao_sede") return TEMPLATES.delib_alteracao_sede(soc, fd);
  if (did === "alteracao_firma") return TEMPLATES.delib_alteracao_firma(soc, fd);
  if (did === "nomeacao_gerente") return TEMPLATES.delib_nomeacao_gerente();
  if (did === "destituicao_gerente") return TEMPLATES.delib_destituicao_gerente(soc, fd);
  if (did === "dissolucao") return TEMPLATES.delib_dissolucao(soc, fd);
  if (did === "aprovacao_contas") return TEMPLATES.delib_aprovacao_contas(soc, fd);
  if (did === "distribuicao_lucros") return TEMPLATES.delib_distribuicao_lucros(soc, fd);
  return `[TEXTO DA DELIBERAÇÃO — ${DELIB_TYPES.find(d => d.id === did)?.label}. A preencher com modelo real da equipa.]`;
}

// ── WIZARD ──────────────────────────────────────────────────────────────

function Wizard({ onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [selSoc, setSelSoc] = useState("");
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [pactoFile, setPactoFile] = useState(null);
  const [activeDoc, setActiveDoc] = useState("ata");

  const soc = SOCIEDADES.find(s => s.id === selSoc);
  const stNames = ["Sociedade", "Deliberações", "Formulários", "Documentos", "Exportação"];

  const getFd = did => fdMap[did] || {};
  const upd = (did, k, v) => setFdMap(p => ({ ...p, [did]: { ...(p[did] || {}), [k]: v } }));
  const togDel = id => setSelDel(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);

  const allVal = useMemo(() => { const r = {}; selDel.forEach(did => { r[did] = validate(did, getFd(did), soc); }); return r; }, [selDel, fdMap, soc]);
  const hasBlock = useMemo(() => Object.values(allVal).some(v => v.B.length > 0), [allVal]);
  const { fx, docs } = useMemo(() => computeEffects(selDel, fdMap, soc), [selDel, fdMap, soc]);

  // RENDER FORM per deliberation (condensed from v3 — same logic)
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

      {["alteracao_firma", "alteracao_sede", "alteracao_objeto", "alteracao_forma_obrigar"].includes(did) && <>
        <Inp label="Texto atual" value={did === "alteracao_firma" ? soc?.firma : did === "alteracao_sede" ? soc?.sede : did === "alteracao_objeto" ? soc?.objeto : soc?.formaObrigar} disabled />
        <Inp label="Novo texto" value={fd.novo_texto} onChange={v => u("novo_texto", v)} required placeholder="Novo texto" />
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}

      {did === "aprovacao_contas" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}><Inp label="Exercício" value={fd.ct_exercicio} onChange={v => u("ct_exercicio", v)} placeholder="2025" required /><Inp label="Resultado Líquido" value={fd.ct_resultado} onChange={v => u("ct_resultado", v)} type="number" placeholder="€" required /></div><Rad label="Decisão" value={fd.ct_decisao} onChange={v => u("ct_decisao", v)} options={[{ v: "aprovadas", l: "Aprovadas" }, { v: "nao", l: "Não aprovadas" }]} required /></>}

      {did === "distribuicao_lucros" && <><Inp label="Montante total" value={fd.dl_total} onChange={v => u("dl_total", v)} type="number" placeholder="€" required />{soc && fd.dl_total && <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 16, border: "1px solid #E2E8F0" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Distribuição (anónima)</div>{soc.socios.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}><span>Sócio {s.id} ({s.pct}%)</span><span style={{ fontWeight: 600, color: C.gn }}>{fmt(Number(fd.dl_total) * s.pct / 100)}</span></div>)}</div>}</>}

      {did === "nomeacao_gerente" && <><Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" placeholder="100" /><Al type="privacy">Dados do gerente serão placeholders: [NOME_GERENTE_NOVO], [NIF_GERENTE_NOVO], [MORADA_GERENTE_NOVO].</Al></>}

      {did === "destituicao_gerente" && <><Sel label="Gerente" value={fd.dest_gerente} onChange={v => u("dest_gerente", v)} options={Array.from({ length: soc?.numGerentes || 0 }, (_, i) => ({ v: `G${i + 1}`, l: `Gerente ${i + 1}` }))} required /><Rad label="Justa causa?" value={fd.dest_justa_causa} onChange={v => u("dest_justa_causa", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} /><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" placeholder="100" /></>}

      {did === "dissolucao" && <><Inp label="Fundamento" value={fd.dis_fund} onChange={v => u("dis_fund", v)} required placeholder="Art. 141.º CSC" /><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" /></>}

      {did === "exclusao_exoneracao" && <><Rad label="Tipo" value={fd.excl_sub} onChange={v => u("excl_sub", v)} options={[{ v: "exclusao", l: "Exclusão" }, { v: "exoneracao", l: "Exoneração" }]} required /><Sel label="Sócio" value={fd.excl_socio} onChange={v => u("excl_socio", v)} options={soc?.socios.map(s => ({ v: s.id, l: `Sócio ${s.id}` })) || []} required />{fd.excl_sub === "exclusao" && <Rad label="Contraditório?" value={fd.excl_contraditorio} onChange={v => u("excl_contraditorio", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />}<Sel label="Destino da quota" value={fd.excl_destino_quota} onChange={v => u("excl_destino_quota", v)} options={[{ v: "amortizacao", l: "Amortização" }, { v: "aquisicao_socios", l: "Aquisição por sócios" }]} required /></>}

      {!["aumento_capital", "cessao_quotas", "alteracao_firma", "alteracao_sede", "alteracao_objeto", "alteracao_forma_obrigar", "aprovacao_contas", "distribuicao_lucros", "nomeacao_gerente", "destituicao_gerente", "dissolucao", "exclusao_exoneracao"].includes(did) && <><div><label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Descrição</label><textarea value={fd.desc || ""} onChange={e => u("desc", e.target.value)} rows={4} style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans',sans-serif", color: "#1F2937", resize: "vertical", outline: "none", boxSizing: "border-box" }} placeholder="Termos da deliberação..." /></div><Inp label="Votos (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" placeholder="100" /></>}
    </div>;
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}><div><h1 style={{ fontSize: 24, fontWeight: 700, color: C.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Nova Deliberação</h1><p style={{ fontSize: 14, color: C.gr, margin: "4px 0 0" }}>Sócios anónimos · Placeholders · Textos reais</p></div><Btn v="ghost" onClick={onCancel}>✕</Btn></div>
    <Steps steps={stNames} cur={step} />

    {/* STEP 0 — Sociedade */}
    {step === 0 && <div>
      <Cd><h3 style={{ fontSize: 16, fontWeight: 600, color: C.d, margin: "0 0 20px" }}>Sociedade</h3>
        <Sel label="Selecionar" value={selSoc} onChange={setSelSoc} options={SOCIEDADES.map(s => ({ v: s.id, l: `${s.firma} (${s.nipc})` }))} required />
        {soc && <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 20, border: "1px solid #E2E8F0", marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>{[["NIPC", soc.nipc], ["Capital", fmt(soc.capital)], ["Tipo", soc.tipo]].map(([l, v], i) => <div key={i}><div style={{ fontSize: 11, fontWeight: 600, color: C.gr, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 600, color: C.d }}>{v}</div></div>)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.gr, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sócios (anónimos)</div>
          {soc.socios.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}><span style={{ fontWeight: 600 }}>Sócio {s.id}</span><span>{fmt(s.quota)} ({s.pct}%){s.penhor ? " · penhor" : ""}</span></div>)}
        </div>}
        {soc && <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Pacto Social do Cliente (documento público — pode ser carregado)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #D1D5DB", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8, background: pactoFile ? "#F0FDF4" : "#fff", color: pactoFile ? C.gn : "#374151" }}>
              {pactoFile ? `✓ ${pactoFile.name}` : "📄 Carregar Pacto Social (.docx)"}
              <input type="file" accept=".docx" onChange={e => setPactoFile(e.target.files[0])} style={{ display: "none" }} />
            </label>
            {pactoFile && <Btn v="ghost" size="sm" onClick={() => setPactoFile(null)}>Remover</Btn>}
          </div>
          <div style={{ fontSize: 11, color: C.gr, marginTop: 6 }}>O pacto social é documento público do registo comercial. A aplicação utilizará este documento como base para gerar a versão consolidada após a deliberação.</div>
        </div>}
      </Cd>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}><Btn disabled={!selSoc} onClick={() => setStep(1)}>Continuar →</Btn></div>
    </div>}

    {/* STEP 1 — Deliberações */}
    {step === 1 && <div>
      <Cd style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16, fontWeight: 600, color: C.d, margin: "0 0 20px" }}>Deliberações</h3>
        {Object.entries(CATS).map(([cid, cl]) => { const items = DELIB_TYPES.filter(d => d.cat === cid); return <div key={cid} style={{ marginBottom: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: C.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>{cl}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{items.map(d => { const sel = selDel.includes(d.id); return <div key={d.id} onClick={() => togDel(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer", border: sel ? `2px solid ${C.d}` : "1px solid #E5E7EB", background: sel ? "#F0F4FF" : "#fff" }}><div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? "none" : "2px solid #D1D5DB", background: sel ? C.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{sel ? "✓" : ""}</div><div><div style={{ fontSize: 13, fontWeight: sel ? 600 : 500, color: C.d }}><span style={{ marginRight: 6, opacity: 0.5 }}>{d.icon}</span>{d.label}</div><div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{d.pacto && <Badge t="Pacto" type="pacto" />}{d.lista && <Badge t="Lista" type="lista" />}{d.registo && <Badge t="Registo" type="registo" />}{d.rcbe && <Badge t="RCBE" type="rcbe" />}</div></div></div> })}</div></div> })}
      </Cd>
      {selDel.length > 0 && <Cd style={{ background: "#FAFBFD", marginBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{selDel.length} deliberação(ões)</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>{fx.pacto && <Badge t="Pacto Social" type="pacto" />}{fx.lista && <Badge t="Lista Sócios" type="lista" />}{fx.registo && <Badge t="Registo" type="registo" />}{fx.rcbe && <Badge t="RCBE" type="rcbe" />}</div><div style={{ fontSize: 12, color: C.gr }}>Docs: {docs.join(" · ")}</div></Cd>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(0)}>← Voltar</Btn><Btn disabled={selDel.length === 0} onClick={() => setStep(2)}>Continuar →</Btn></div>
    </div>}

    {/* STEP 2 — Formulários */}
    {step === 2 && <div>
      {fx.rcbe && <div style={{ marginBottom: 12 }}><Al type="warning" title="RCBE">Atualização obrigatória no prazo de 30 dias (art. 14.º Lei 89/2017).</Al></div>}
      {selDel.map(did => { const dt = DELIB_TYPES.find(d => d.id === did); return <Cd key={did} style={{ marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: C.d, display: "flex", alignItems: "center", justifyContent: "center", color: C.g, fontSize: 14, fontWeight: 700 }}>{dt.icon}</div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.d, margin: 0 }}>{dt.label}</h3></div>{renderForm(did)}</Cd> })}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(1)}>← Voltar</Btn><div style={{ display: "flex", gap: 12 }}><Btn v="secondary">Rascunho</Btn><Btn disabled={hasBlock} onClick={() => setStep(3)}>{hasBlock ? "Bloqueios ⛔" : "Documentos →"}</Btn></div></div>
    </div>}

    {/* STEP 3 — Document Preview */}
    {step === 3 && <div>
      {/* Doc tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #E5E7EB", marginBottom: 24 }}>
        {[{ id: "ata", l: "Ata" }, { id: "lista", l: "Lista de Sócios" }, ...(selDel.includes("cessao_quotas") ? [{ id: "cessao", l: "Contrato Cessão" }] : [])].map(t => (
          <button key={t.id} onClick={() => setActiveDoc(t.id)} style={{ padding: "12px 20px", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: activeDoc === t.id ? 600 : 400, color: activeDoc === t.id ? C.d : C.gr, background: "transparent", borderBottom: activeDoc === t.id ? `2px solid ${C.d}` : "2px solid transparent", marginBottom: -2 }}>{t.l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <Cd style={{ padding: 40 }}>
          {activeDoc === "ata" && <AtaPreview soc={soc} selDel={selDel} fdMap={fdMap} />}
          {activeDoc === "lista" && <div style={{ fontFamily: "'Times New Roman',serif", fontSize: 13, lineHeight: 2, maxWidth: 640, margin: "0 auto" }}><DocText text={TEMPLATES.lista_socios(soc)} /></div>}
          {activeDoc === "cessao" && <div style={{ fontFamily: "'Times New Roman',serif", fontSize: 13, lineHeight: 2, maxWidth: 640, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24, padding: 20, border: "1px solid #D1D5DB" }}>
              <DocText text={TEMPLATES.contrato_cessao_capa(soc, getFd("cessao_quotas"))} />
            </div>
            <p style={{ fontStyle: "italic", color: C.gr }}>[O contrato completo será gerado com as cláusulas standard da equipa: Objeto, Preço, Declarações Negociais, Capital Social, Registos e Despesas, Comunicações, Alterações, Foro Convencional.]</p>
          </div>}
        </Cd>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Cd><h4 style={{ fontSize: 13, fontWeight: 600, color: C.d, margin: "0 0 12px" }}>Documentos</h4>{docs.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < docs.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13, color: "#374151" }}><span style={{ color: C.gn, fontSize: 11 }}>●</span>{d}</div>)}</Cd>
          {fx.pacto && <Al type="legal" title="Pacto Social">{pactoFile ? `Base: ${pactoFile.name} — artigos alterados serão atualizados automaticamente.` : "Gerar versão consolidada. Considere carregar o pacto atual do cliente no Passo 1."}</Al>}
          {fx.rcbe && <Al type="warning" title="RCBE">30 dias para atualização (Lei 89/2017).</Al>}
          <Al type="privacy" title="Placeholders">Os campos [NOME_SOCIO_X], [NIF_X], [MORADA_X] aparecem a amarelo. Preencher localmente em Word após exportação.</Al>

          <Cd style={{ background: "#F8FAFC" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Legenda dos placeholders</div>
            <div style={{ fontSize: 11, color: C.gr, lineHeight: 1.8 }}>
              <DocText text="[NOME_SOCIO_X]" /> — Nome completo<br />
              <DocText text="[NIF_X]" /> — Número de identificação fiscal<br />
              <DocText text="[CC_X]" /> — Cartão de cidadão<br />
              <DocText text="[MORADA_X]" /> — Residência<br />
              <DocText text="[ESTADO_CIVIL_X]" /> — Estado civil<br />
              <DocText text="[NATURALIDADE_X]" /> — Naturalidade<br />
              <DocText text="[DIA_EXTENSO]" /> — Data por extenso<br />
            </div>
          </Cd>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}><Btn v="secondary" onClick={() => setStep(2)}>← Voltar</Btn><div style={{ display: "flex", gap: 12 }}><Btn v="secondary">Rascunho</Btn><Btn v="accent" onClick={() => setStep(4)}>Gerar DOCX →</Btn></div></div>
    </div>}

    {/* STEP 4 — Export */}
    {step === 4 && <Cd style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", border: "2px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✓</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.d, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Documentos Gerados</h2>
      <p style={{ fontSize: 14, color: C.gr, margin: "0 0 6px" }}>{soc?.firma}</p>
      <p style={{ fontSize: 12, color: C.gn, margin: "0 0 32px" }}>🔒 Com [PLACEHOLDERS] — preencher dados pessoais em Word</p>
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "left" }}>{docs.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 8, marginBottom: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>📄</span><span style={{ fontSize: 13, fontWeight: 500 }}>{d}</span></div><div style={{ display: "flex", gap: 8 }}><Btn v="ghost" size="sm">DOCX</Btn></div></div>)}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}><Btn v="secondary" onClick={() => setStep(3)}>← Rever</Btn><Btn v="accent" onClick={onDone}>Concluir</Btn></div>
    </Cd>}
  </div>;
}

// ── SOCIEDADES ───────────────────────────────────────────────────────────

function Sociedades({ onSel }) {
  return <div>
    <h1 style={{ fontSize: 26, fontWeight: 700, color: C.d, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Sociedades</h1>
    <Al type="privacy" title="Política">Apenas dados públicos. Sem nomes, NIFs ou moradas.</Al>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16, marginTop: 20 }}>
      {SOCIEDADES.map(soc => <Cd key={soc.id} hover onClick={() => onSel(soc)}>
        <div style={{ marginBottom: 16 }}><div style={{ fontSize: 16, fontWeight: 700, color: C.d, marginBottom: 4 }}>{soc.firma}</div><div style={{ fontSize: 12, color: C.gr }}>NIPC: {soc.nipc} · {soc.tipo}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 16 }}><div><div style={{ color: C.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Capital</div><div style={{ fontWeight: 600 }}>{fmt(soc.capital)}</div></div><div><div style={{ color: C.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Sócios</div><div style={{ fontWeight: 600 }}>{soc.socios.length}</div></div></div>
        {soc.socios.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}><span>Sócio {s.id}</span><span style={{ fontWeight: 600 }}>{fmt(s.quota)} ({s.pct}%)</span></div>)}
      </Cd>)}
    </div>
  </div>;
}

// ── APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selSoc, setSelSoc] = useState(null);
  const ct = s => [{ id: "p1", soc: "s1", tipo: ["cessao_quotas"], status: "concluido", data: "2025-11-15", desc: "Cessão de quota" }, { id: "p2", soc: "s1", tipo: ["aprovacao_contas", "distribuicao_lucros"], status: "revisto", data: "2025-12-20", desc: "Contas 2024" }, { id: "p3", soc: "s2", tipo: ["aumento_capital"], status: "rascunho", data: "2026-01-10", desc: "Aumento de capital" }].filter(p => !s || p.status === s).length;

  return <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F1F3F5;color:#1F2937;-webkit-font-smoothing:antialiased}::selection{background:#B8976A33}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#B8976A!important;box-shadow:0 0 0 3px #B8976A18}`}</style>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={view} setActive={v => { setView(v); setSelSoc(null) }} />
      <main style={{ flex: 1, padding: "32px 40px", maxHeight: "100vh", overflow: "auto" }}>
        {view === "wizard" ? <Wizard onCancel={() => setView("dashboard")} onDone={() => setView("dashboard")} /> :
          view === "sociedades" ? <Sociedades onSel={s => setSelSoc(s)} /> :
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}><div><h1 style={{ fontSize: 26, fontWeight: 700, color: C.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Dashboard</h1><p style={{ fontSize: 14, color: C.gr, margin: "6px 0 0" }}>Textos reais · Placeholders · Sócios anónimos</p></div><Btn v="accent" size="lg" onClick={() => setView("wizard")}>+ Nova Deliberação</Btn></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 }}>
                {[{ l: "Total", v: 3, c: C.d }, { l: "Rascunhos", v: 1, c: C.gr }, { l: "Concluídos", v: 1, c: C.gn }].map((s, i) => <Cd key={i}><div style={{ fontSize: 11, fontWeight: 600, color: C.gr, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{s.l}</div><div style={{ fontSize: 32, fontWeight: 700, color: s.c, fontFamily: "'Playfair Display',serif" }}>{s.v}</div></Cd>)}
              </div>
              <Al type="privacy" title="Arquitetura de privacidade ativa">Dados pessoais nunca tocam o servidor. Documentos gerados com [PLACEHOLDERS] para preenchimento local em Word. Sócios identificados como Sócio A, B, C.</Al>
            </div>}
      </main>
    </div>
  </>;
}
