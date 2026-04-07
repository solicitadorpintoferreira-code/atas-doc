import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } from "docx";
import { saveAs } from "file-saver";

// ═══════════════════════════════════════════════════════════════════════
// ATAS PRO v8 — Deliberações + Operações M&A (intake estruturado)
// ═══════════════════════════════════════════════════════════════════════
// Módulo Deliberações: NIPC → Wizard → DOCX (mantido do v6)
// Módulo Operações: Wizard dinâmico → Pacote para colar no Claude.ai
//   - Sem chamadas à API
//   - Sem Netlify Functions
//   - Funciona com Netlify Drop
// ═══════════════════════════════════════════════════════════════════════

// ── LOCALSTORAGE ──────────────────────────────────────────────────────

const STORE_KEY = "atas_pro_sociedades";
const OPS_STORE_KEY = "atas_pro_operacoes_v8";

function loadSociedades() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; } }
function saveSociedade(soc) { const all = loadSociedades(); const idx = all.findIndex(s => s.nipc === soc.nipc); if (idx >= 0) all[idx] = soc; else all.push(soc); localStorage.setItem(STORE_KEY, JSON.stringify(all)); }
function findByNipc(nipc) { return loadSociedades().find(s => s.nipc === nipc.replace(/\s/g, "")); }
function loadOperacoes() { try { return JSON.parse(localStorage.getItem(OPS_STORE_KEY) || "[]"); } catch { return []; } }
function saveOperacao(op) { const all = loadOperacoes(); const idx = all.findIndex(o => o.id === op.id); if (idx >= 0) all[idx] = op; else all.push(op); localStorage.setItem(OPS_STORE_KEY, JSON.stringify(all)); }
function deleteOperacao(id) { const all = loadOperacoes().filter(o => o.id !== id); localStorage.setItem(OPS_STORE_KEY, JSON.stringify(all)); }

// ── UTILITIES ─────────────────────────────────────────────────────────

const fmt = v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);
const fmtD = d => new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });

function extenso(v) {
  const n = Number(v); if (!n) return "zero euros";
  const u = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const t2 = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"];
  const t = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const h = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  function w(n) {
    if (n === 0) return ""; if (n === 100) return "cem"; if (n < 10) return u[n]; if (n < 20) return t2[n - 10];
    if (n < 100) { const d = t[Math.floor(n / 10)], r = n % 10; return r ? `${d} e ${u[r]}` : d; }
    if (n < 1000) { const c = h[Math.floor(n / 100)], r = n % 100; return r ? `${n === 100 ? "cem" : c} e ${w(r)}` : (n === 100 ? "cem" : c); }
    if (n < 1000000) { const th = Math.floor(n / 1000), r = n % 1000; const tw = th === 1 ? "mil" : `${w(th)} mil`; return r ? (r < 100 ? `${tw} e ${w(r)}` : `${tw} ${w(r)}`) : tw; }
    return String(n);
  }
  const cents = Math.round((n % 1) * 100);
  let r = w(Math.floor(n)) + " euros";
  if (cents > 0) r += ` e ${w(cents)} cêntimos`;
  return r;
}

// ── UI PRIMITIVES ─────────────────────────────────────────────────────

const CL = { d: "#0F172A", g: "#B8976A", gr: "#6B7280", gn: "#059669", r: "#DC2626", bl: "#2563EB", am: "#D97706" };

function Badge({ t, type }) {
  const m = {
    pacto: { bg: "#FEF3C7", c: "#92400E", i: "◆" },
    lista: { bg: "#DBEAFE", c: "#1E40AF", i: "☰" },
    registo: { bg: "#FCE7F3", c: "#9D174D", i: "⬡" },
    rcbe: { bg: "#F3E8FF", c: "#6B21A8", i: "◎" },
    block: { bg: "#FEE2E2", c: "#991B1B", i: "⛔" },
    warn: { bg: "#FFFBEB", c: "#92400E", i: "⚠" },
    info: { bg: "#EFF6FF", c: "#1E40AF", i: "ℹ" },
    legal: { bg: "#FDF8F0", c: "#78582A", i: "§" },
    privacy: { bg: "#ECFDF5", c: "#166534", i: "🔒" },
    fiscal: { bg: "#FFF7ED", c: "#9A3412", i: "⚠" },
    crossing: { bg: "#FEF3C7", c: "#92400E", i: "⇄" },
    success: { bg: "#F0FDF4", c: "#166534", i: "✓" }
  }[type] || { bg: "#F3F4F6", c: "#374151", i: "•" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: m.bg, color: m.c }}>{m.i} {t}</span>;
}

function Cd({ children, style, onClick, hover }) {
  const [h, sH] = useState(false);
  return <div onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...(hover && h ? { borderColor: CL.g, boxShadow: "0 4px 12px rgba(184,151,106,0.12)" } : {}), ...style }}>{children}</div>;
}

function Inp({ label, value, onChange, placeholder, type = "text", required, disabled, eph, style: sx, multiline, rows, hint }) {
  const labelEl = label && <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}{required && <span style={{ color: CL.g }}> *</span>}{eph && <span style={{ fontSize: 9, color: CL.gn, fontWeight: 600, background: "#ECFDF5", padding: "1px 6px", borderRadius: 3, marginLeft: 6 }}>placeholder</span>}</label>;
  const hintEl = hint && <span style={{ fontSize: 11, color: CL.gr, fontStyle: "italic" }}>{hint}</span>;
  if (multiline) return <div style={{ display: "flex", flexDirection: "column", gap: 6, ...sx }}>{labelEl}{hintEl}<textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} rows={rows || 3} style={{ padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans',sans-serif", color: "#1F2937", background: disabled ? "#F9FAFB" : "#fff", outline: "none", resize: "vertical", boxSizing: "border-box" }} /></div>;
  return <div style={{ display: "flex", flexDirection: "column", gap: 6, ...sx }}>{labelEl}{hintEl}<input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{ padding: "10px 14px", border: `1px solid ${eph ? "#A7F3D0" : "#D1D5DB"}`, borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans',sans-serif", color: "#1F2937", background: disabled ? "#F9FAFB" : eph ? "#F0FDF9" : "#fff", outline: "none" }} onFocus={e => e.target.style.borderColor = CL.g} onBlur={e => e.target.style.borderColor = eph ? "#A7F3D0" : "#D1D5DB"} /></div>;
}

function Sel({ label, value, onChange, options, required, placeholder, hint }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}{required && <span style={{ color: CL.g }}> *</span>}</label>}
    {hint && <span style={{ fontSize: 11, color: CL.gr, fontStyle: "italic" }}>{hint}</span>}
    <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans',sans-serif", color: value ? "#1F2937" : "#9CA3AF", background: "#fff", outline: "none", cursor: "pointer" }}>
      <option value="">{placeholder || "Selecionar..."}</option>
      {options.map(o => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
    </select>
  </div>;
}

function Rad({ label, value, onChange, options, required, hint }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}{required && <span style={{ color: CL.g }}> *</span>}</label>}
    {hint && <span style={{ fontSize: 11, color: CL.gr, fontStyle: "italic" }}>{hint}</span>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(o => <div key={o.v} onClick={() => onChange(o.v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 6, cursor: "pointer", border: value === o.v ? `2px solid ${CL.d}` : "1px solid #D1D5DB", background: value === o.v ? "#F0F4FF" : "#fff", fontSize: 13, fontWeight: value === o.v ? 600 : 400 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: value === o.v ? "none" : "2px solid #D1D5DB", background: value === o.v ? CL.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{value === o.v && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}</div>
        {o.l}
      </div>)}
    </div>
  </div>;
}

function Chk({ label, options, values = [], onChange, hint }) {
  const toggle = v => { if (values.includes(v)) onChange(values.filter(x => x !== v)); else onChange([...values, v]); };
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</label>}
    {hint && <span style={{ fontSize: 11, color: CL.gr, fontStyle: "italic" }}>{hint}</span>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(o => {
        const sel = values.includes(o.v);
        return <div key={o.v} onClick={() => toggle(o.v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 6, cursor: "pointer", border: sel ? `2px solid ${CL.d}` : "1px solid #D1D5DB", background: sel ? "#F0F4FF" : "#fff", fontSize: 13, fontWeight: sel ? 600 : 400 }}>
          <div style={{ width: 16, height: 16, borderRadius: 3, border: sel ? "none" : "2px solid #D1D5DB", background: sel ? CL.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{sel ? "✓" : ""}</div>
          {o.l}
        </div>;
      })}
    </div>
  </div>;
}

function Btn({ children, onClick, v = "primary", size = "md", disabled, style: sx }) {
  const s = { primary: { bg: CL.d, c: "#fff", b: "none" }, secondary: { bg: "#fff", c: CL.d, b: "1px solid #D1D5DB" }, accent: { bg: CL.g, c: "#fff", b: "none" }, ghost: { bg: "transparent", c: CL.gr, b: "none" }, danger: { bg: "#DC2626", c: "#fff", b: "none" } }[v];
  return <button onClick={onClick} disabled={disabled} style={{ padding: size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "10px 20px", borderRadius: 6, fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, background: disabled ? "#E5E7EB" : s.bg, color: disabled ? "#9CA3AF" : s.c, border: s.b || "none", opacity: disabled ? 0.7 : 1, ...sx }}>{children}</button>;
}

function Al({ type, title, children }) {
  const m = { info: { bg: "#EFF6FF", b: "#3B82F6", c: "#1E40AF", i: "ℹ" }, warning: { bg: "#FFFBEB", b: "#F59E0B", c: "#92400E", i: "⚠" }, block: { bg: "#FEE2E2", b: "#EF4444", c: "#991B1B", i: "⛔" }, legal: { bg: "#FDF8F0", b: CL.g, c: "#78582A", i: "§" }, privacy: { bg: "#ECFDF5", b: CL.gn, c: "#166534", i: "🔒" }, success: { bg: "#F0FDF4", b: "#22C55E", c: "#166534", i: "✓" }, fiscal: { bg: "#FFF7ED", b: "#EA580C", c: "#9A3412", i: "⚠" }, crossing: { bg: "#FFFBEB", b: "#D97706", c: "#92400E", i: "⇄" }, suggestion: { bg: "#F0F9FF", b: "#0EA5E9", c: "#0C4A6E", i: "💡" } }[type];
  return <div style={{ display: "flex", gap: 14, padding: 16, borderRadius: 8, background: m.bg, borderLeft: `3px solid ${m.b}` }}><span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{m.i}</span><div style={{ flex: 1 }}>{title && <div style={{ fontSize: 13, fontWeight: 600, color: m.c, marginBottom: 4 }}>{title}</div>}<div style={{ fontSize: 13, color: m.c, lineHeight: 1.5 }}>{children}</div></div></div>;
}

function ProgressBar({ value, label }) {
  return <div style={{ marginBottom: 6 }}>
    {label && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: value >= 100 ? CL.gn : CL.g }}>{Math.min(Math.round(value), 100)}%</span>
    </div>}
    <div style={{ height: 5, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 3, background: value >= 100 ? CL.gn : `linear-gradient(90deg, ${CL.g}, #D4B88C)`, width: `${Math.min(value, 100)}%`, transition: "width 0.4s ease" }} />
    </div>
  </div>;
}

function DocText({ text }) { if (!text) return null; const parts = text.split(/(\[[A-Z_]+(?:_[A-Z0-9]+)*\])/g); return <>{parts.map((p, i) => p.startsWith("[") && p.endsWith("]") ? <span key={i} style={{ background: "#FEF3C7", color: "#92400E", padding: "1px 4px", borderRadius: 3, fontWeight: 600, fontSize: "0.95em", fontFamily: "monospace" }}>{p}</span> : <span key={i}>{p}</span>)}</>; }

// ── SIDEBAR ───────────────────────────────────────────────────────────

function Sidebar({ active, setActive }) {
  const nav = [
    { id: "dashboard", l: "Dashboard", i: "⊞" },
    { id: "wizard", l: "Nova Deliberação", i: "+" },
    { id: "operacoes", l: "Operações M&A", i: "⇌" },
    { id: "sociedades", l: "Sociedades", i: "◈" },
  ];
  return <div style={{ width: 260, minHeight: "100vh", background: CL.d, display: "flex", flexDirection: "column", flexShrink: 0 }}>
    <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid #1E293B" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${CL.g},#D4B88C)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: CL.d }}>§</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em", fontFamily: "'Playfair Display',serif" }}>ATAS PRO</div>
          <div style={{ fontSize: 10, color: "#64748B", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>v8</div>
        </div>
      </div>
    </div>
    <nav style={{ padding: "16px 12px", flex: 1 }}>
      {nav.map(n => <button key={n.id} onClick={() => setActive(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: active === n.id ? 600 : 400, fontFamily: "'DM Sans',sans-serif", marginBottom: 4, background: active === n.id ? "#1E293B" : "transparent", color: active === n.id ? "#F1F5F9" : "#94A3B8" }}>
        <span style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: active === n.id ? CL.g + "22" : "transparent", color: active === n.id ? CL.g : "#64748B" }}>{n.i}</span>
        {n.l}
      </button>)}
    </nav>
    <div style={{ padding: "16px 24px 24px", borderTop: "1px solid #1E293B" }}>
      <div style={{ fontSize: 10, color: CL.gn, fontWeight: 500 }}>P&A Legal — uso interno</div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO DELIBERAÇÕES (mantido do v6)
// ═══════════════════════════════════════════════════════════════════════

const T = {
  preambulo: (soc, uni) => uni
    ? `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu na sua sede social, sita em ${soc.sede}, em Assembleia Geral extraordinária da Sociedade ${soc.firma} (doravante apenas a "Sociedade"), registada na Conservatória do Registo Comercial sob o número único de matrícula e de identificação fiscal ${soc.nipc}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), totalmente realizado.`
    : `Aos [DIA_EXTENSO] dias do mês de [MÊS_EXTENSO] de [ANO_EXTENSO], pelas [HORA] horas, reuniu, na sua sede social, sita em ${soc.sede}, a Assembleia Geral Extraordinária da sociedade ${soc.tipo.toLowerCase()}, denominada "${soc.firma}", com o número único de matrícula e de identificação fiscal ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}).`,
  socio: (id) => `[NOME_SOCIO_${id}], [ESTADO_CIVIL_${id}], natural da freguesia de [NATURALIDADE_${id}], concelho de [CONCELHO_${id}], com o número de identificação fiscal [NIF_${id}], portador do Cartão de Cidadão número [CC_${id}], emitido pela República Portuguesa e válido até [CC_VALIDADE_${id}], residente em [MORADA_${id}]`,
  universal: (uni) => uni ? "Estando representada a totalidade do capital social, o sócio único concordou em reunir e deliberar sem formalidades prévias, nos termos do artigo 54.º do Código das Sociedades Comerciais, sobre os assuntos que constituem a seguinte ordem de trabalhos:" : "Verificando-se estar reunida a totalidade do capital social e tendo sido dispensadas todas as formalidades prévias de convocação nos termos do artigo 54.º do Código das Sociedades Comerciais, assumiu a presidência da assembleia o sócio-gerente [NOME_PRESIDENTE], tendo ainda os sócios manifestado a sua vontade no sentido de que a assembleia se constituísse e deliberasse sobre a seguinte ordem de trabalhos:",
  encerramento: (uni) => uni ? "Não havendo outros assuntos a tratar, foi encerrada a assembleia pelas [HORA_FIM] horas e lavrada a presente ata, que depois de lida e aprovada vai ser assinada pelo sócio presente." : "Nada mais havendo a tratar, foi encerrada a sessão pelas [HORA_FIM] horas, dela se lavrando a presente ata, a qual, depois de lida e aprovada, vai ser assinada pelos sócios, em sinal de conformidade.",
  delib_cessao: (soc, fd) => `Entrou-se na discussão, tendo sido comunicado pelo sócio a cessão de quotas, efetuada por contrato particular, tendo sido cedida a quota do sócio [NOME_CEDENTE], com o valor nominal de ${fd.ces_vn ? fmt(Number(fd.ces_vn)) : "[VALOR]"}, correspondente a [PERCENTAGEM]% do capital da sociedade, a [NOME_CESSIONARIO]. Em conformidade com o disposto no artigo 228.º n.º 2 do Código das Sociedades Comerciais, a referida cessão de quotas encontra-se ${fd.ces_consentimento_exigido === "nao" ? "dispensada de consentimento da sociedade, por se tratar de negócio celebrado entre sócios" : "sujeita ao consentimento da sociedade, o qual foi deliberado e concedido por unanimidade"}.`,
  delib_aumento: (soc, fd) => { const m = Number(fd.aum_montante) || 0; const nc = (soc.capital || 0) + m; return `Foi apresentado um conjunto de considerações sobre a necessidade de serem reforçados os capitais próprios da sociedade, através de um aumento de capital na modalidade de novas entradas em numerário. O reforço no montante de ${fmt(m)} (${extenso(m)}) eleva o capital social de ${fmt(soc.capital)} para ${fmt(nc)} (${extenso(nc)}). ${fd.aum_realizacao_integral === "sim" ? "Declara-se, nos termos e para os efeitos do artigo 88.º do CSC, que a entrada em numerário já foi realizada, encontrando-se o respetivo valor depositado nos cofres da Sociedade." : "As entradas serão realizadas no prazo de [PRAZO_REALIZACAO]."}`; },
  delib_alteracao_firma: (soc, fd) => `Foi deliberado e aprovado a alteração da firma da sociedade, que passa a ser: "${fd.novo_texto || "[NOVA_FIRMA]"}".${fd.cert_dispensado ? ` A alteração de firma não necessita de certificado de admissibilidade, ${fd.cert_motivo_dispensa || "por a alteração se restringir à alteração do tipo de pessoa coletiva — art. 54.º, n.º 3 do RJRNPC"}.` : ` A admissibilidade da nova firma foi objeto do certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,
  delib_alteracao_sede: (soc, fd) => `Foi deliberado e aprovado a alteração da sede da sociedade para: "${fd.novo_texto || "[NOVA_SEDE]"}".${fd.cert_dispensado ? ` A alteração de sede não necessita de certificado de admissibilidade.` : ` Certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,
  delib_alteracao_objeto: (soc, fd) => `Foi deliberado e aprovado a alteração do objeto social da sociedade, que passa a ter a seguinte redação: "${fd.novo_texto || "[NOVO_OBJETO]"}".${fd.cert_dispensado ? ` Não é necessário certificado de admissibilidade.` : ` Certificado de admissibilidade n.º ${fd.cert_numero || "[N.º CERTIFICADO]"}.`}`,
  delib_nomeacao_gerente: () => `Foi proposto e aprovado por unanimidade a nomeação de [NOME_GERENTE_NOVO], [ESTADO_CIVIL_GERENTE], NIF [NIF_GERENTE_NOVO], residente em [MORADA_GERENTE_NOVO], para o cargo de gerente da sociedade. O nomeado declara aceitar o cargo para que foi eleito.`,
  delib_destituicao: (fd) => `Foi deliberado a destituição de [NOME_GERENTE_DESTITUIDO] do cargo de gerente${fd.dest_justa_causa === "sim" ? ", com justa causa" : ". A destituição opera sem invocação de justa causa, ficando ressalvado o direito a eventual indemnização nos termos legais"}.`,
  delib_dissolucao: (fd) => `Foi deliberado, por unanimidade, a dissolução da sociedade, ao abrigo do artigo 141.º, n.º 1, alínea b) do CSC${fd.dis_fund ? `, com o seguinte fundamento: ${fd.dis_fund}` : ""}. A firma passa a incluir a menção "em liquidação".`,
  delib_contas: (fd) => `Foi apresentado o balanço, a demonstração de resultados e demais documentos referentes ao exercício de ${fd.ct_exercicio || "[ANO]"}, tendo sido deliberado ${fd.ct_decisao === "aprovadas" ? "aprovar" : "não aprovar"} as contas, com resultado líquido de ${fd.ct_resultado ? fmt(Number(fd.ct_resultado)) : "[VALOR]"}.`,
  delib_lucros: (fd) => `Foi deliberado proceder à distribuição de resultados no montante de ${fd.dl_total ? fmt(Number(fd.dl_total)) : "[VALOR]"}, na proporção das respetivas participações sociais.`,
};

async function generateAtaDocx(soc, selDel, fdMap) {
  const uni = soc.socios.length === 1;
  const pontos = ["Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito"];
  const children = [];
  const p = (text, opts = {}) => new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { after: opts.after || 200, before: opts.before || 0, line: 360 }, indent: opts.indent ? { left: 720 } : undefined, children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold })] });
  children.push(p(`ATA N.º [NÚMERO]`, { center: true, bold: true, after: 400 }));
  children.push(p(T.preambulo(soc, uni)));
  children.push(p(uni ? "Encontrava-se presente o sócio:" : "Encontravam-se presentes os sócios:", { before: 200 }));
  soc.socios.forEach((s, i) => { children.push(p(`${String.fromCharCode(97 + i)}) ${T.socio(s.id)}, titular de uma quota no valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), correspondente a ${s.pct}% do capital social.`, { indent: true })); });
  children.push(p(T.universal(uni), { before: 200 }));
  selDel.forEach((did, i) => { children.push(p(`Ponto ${pontos[i] || i + 1}: ${getOrdemDia(did, fdMap[did] || {})}`, { bold: true })); });
  selDel.forEach((did, i) => { const fd = fdMap[did] || {}; children.push(p(`Entrou-se ${i === 0 ? "de imediato" : "seguidamente"} na discussão do Ponto ${pontos[i] || i + 1} da Ordem de Trabalhos.`, { before: 300, bold: true })); children.push(p(getDelibText(did, soc, fd))); });
  children.push(p(T.encerramento(uni), { before: 400 }));
  soc.socios.forEach(s => { children.push(new Paragraph({ spacing: { before: 600 }, children: [] })); children.push(p("______________________________")); children.push(p(`[NOME_SOCIO_${s.id}]`)); });
  const doc = new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Ata_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

async function generateListaSociosDocx(soc) {
  const children = [];
  const p = (text, opts = {}) => new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { after: opts.after || 200, line: 360 }, indent: opts.indent ? { left: 720 } : undefined, children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: opts.bold })] });
  children.push(p("LISTA DE SÓCIOS", { center: true, bold: true, after: 400 }));
  children.push(p(`${soc.firma}, ${soc.tipo.toLowerCase()}, com o número de pessoa coletiva ${soc.nipc}, matriculada na Conservatória do Registo Comercial sob o mesmo número, com sede em ${soc.sede}, com o capital social de ${fmt(soc.capital)} (${extenso(soc.capital)}), representado pela${soc.socios.length > 1 ? "s seguintes quotas" : " seguinte quota"}:`));
  soc.socios.forEach((s, i) => { children.push(p(`${String.fromCharCode(97 + i)}) Uma quota com o valor nominal de ${fmt(s.quota)} (${extenso(s.quota)}), representativa de ${s.pct}% da totalidade do capital social, pertencente a ${T.socio(s.id)}.`, { indent: true })); });
  children.push(p("[LOCAL], [DATA]", { before: 400 }));
  children.push(p(soc.socios.length > 1 ? "Os Sócios," : "O Sócio,", { before: 200 }));
  soc.socios.forEach(s => { children.push(new Paragraph({ spacing: { before: 500 }, children: [] })); children.push(p("______________________________")); children.push(p(`[NOME_SOCIO_${s.id}]`)); });
  const doc = new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } }, sections: [{ properties: { page: { margin: { top: 1440, right: 1200, bottom: 1200, left: 1440 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Lista_Socios_${soc.firma.replace(/[^a-zA-Z0-9]/g, "_")}.docx`);
}

const DELIB_TYPES = [
  { id: "aumento_capital", label: "Aumento de Capital", icon: "↑", cat: "capital", pacto: true, lista: true, registo: true, rcbe: true, maioria: true },
  { id: "suprimentos", label: "Suprimentos", icon: "§", cat: "capital" },
  { id: "prestacoes_suplementares", label: "Prestações Suplementares", icon: "±", cat: "capital", pacto: "cond" },
  { id: "cessao_quotas", label: "Cessão de Quotas", icon: "⇄", cat: "quotas", lista: true, registo: true, rcbe: true },
  { id: "amortizacao", label: "Amortização de Quotas", icon: "✕", cat: "quotas", pacto: "cond", lista: true, registo: true, rcbe: true },
  { id: "exclusao_exoneracao", label: "Exclusão / Exoneração", icon: "⊘", cat: "socios", lista: true, registo: true, rcbe: true },
  { id: "alteracao_firma", label: "Alteração de Firma", icon: "A", cat: "pacto", pacto: true, registo: true, maioria: true, certAdm: true },
  { id: "alteracao_sede", label: "Alteração de Sede", icon: "⌂", cat: "pacto", pacto: true, registo: true, maioria: true, certAdm: true },
  { id: "alteracao_objeto", label: "Alteração de Objeto", icon: "◈", cat: "pacto", pacto: true, registo: true, maioria: true, certAdm: true },
  { id: "alteracao_forma_obrigar", label: "Forma de Obrigar", icon: "⊡", cat: "pacto", pacto: true, registo: true, maioria: true },
  { id: "aprovacao_contas", label: "Aprovação de Contas", icon: "✓", cat: "contas" },
  { id: "distribuicao_lucros", label: "Distribuição de Lucros", icon: "€", cat: "contas" },
  { id: "dissolucao", label: "Dissolução", icon: "⊗", cat: "vida", pacto: true, registo: true, maioria: true },
  { id: "nomeacao_gerente", label: "Nomeação de Gerente", icon: "⊞", cat: "gerencia", registo: true },
  { id: "destituicao_gerente", label: "Destituição de Gerente", icon: "⊟", cat: "gerencia", registo: true },
  { id: "outra", label: "Outra Deliberação", icon: "…", cat: "outros" },
];

const CATS = { capital: "Estrutura de Capital", quotas: "Quotas", socios: "Sócios", pacto: "Pacto Social", contas: "Contas e Resultados", vida: "Vida da Sociedade", gerencia: "Gerência", outros: "Outros" };
const AUM_SUBS = [{ id: "dinheiro_socios", l: "Entradas em dinheiro — só sócios" }, { id: "dinheiro_novos", l: "Entradas em dinheiro — com novos sócios" }, { id: "reservas", l: "Incorporação de reservas" }, { id: "conversao_assembleia", l: "Conversão de suprimentos" }, { id: "especie", l: "Entradas em espécie" }];
const CESSAO_SUBS = [{ id: "socios_familia", l: "Entre sócios ou família" }, { id: "terceiro_consentimento", l: "A terceiro com consentimento" }];
const CERT_DISPENSAS = [{ id: "tipo_pc", l: "Alteração restrita ao tipo de pessoa coletiva — art. 54.º, n.º 3 RJRNPC" }, { id: "fantasia", l: "Firma constituída por expressão de fantasia — art. 54.º, n.º 3 RJRNPC" }, { id: "outro", l: "Outro motivo de dispensa" }];

function getOrdemDia(did, fd) {
  const m = { aumento_capital: "Deliberar sobre o aumento do capital social.", cessao_quotas: "Informar sobre a cessão de quotas.", alteracao_firma: "Deliberar sobre a alteração da firma.", alteracao_sede: "Deliberar sobre a alteração da sede.", alteracao_objeto: "Deliberar sobre a alteração do objeto social.", alteracao_forma_obrigar: "Deliberar sobre a alteração da forma de obrigar.", aprovacao_contas: `Deliberar sobre a aprovação das contas do exercício de ${fd.ct_exercicio || "[ANO]"}.`, distribuicao_lucros: "Deliberar sobre a distribuição de lucros.", dissolucao: "Deliberar sobre a dissolução da sociedade.", nomeacao_gerente: "Deliberar sobre a nomeação de gerente.", destituicao_gerente: "Deliberar sobre a destituição de gerente." };
  return m[did] || `Deliberar sobre ${DELIB_TYPES.find(d => d.id === did)?.label || "[deliberação]"}.`;
}

function getDelibText(did, soc, fd) {
  if (did === "cessao_quotas") return T.delib_cessao(soc, fd);
  if (did === "aumento_capital") return T.delib_aumento(soc, fd);
  if (did === "alteracao_firma") return T.delib_alteracao_firma(soc, fd);
  if (did === "alteracao_sede") return T.delib_alteracao_sede(soc, fd);
  if (did === "alteracao_objeto") return T.delib_alteracao_objeto(soc, fd);
  if (did === "nomeacao_gerente") return T.delib_nomeacao_gerente();
  if (did === "destituicao_gerente") return T.delib_destituicao(fd);
  if (did === "dissolucao") return T.delib_dissolucao(fd);
  if (did === "aprovacao_contas") return T.delib_contas(fd);
  if (did === "distribuicao_lucros") return T.delib_lucros(fd);
  return `[TEXTO DA DELIBERAÇÃO — ${DELIB_TYPES.find(d => d.id === did)?.label}]`;
}

function validate(did, fd, soc) {
  const B = [], W = [], I = []; if (!soc) return { B, W, I };
  const dt = DELIB_TYPES.find(d => d.id === did);
  if (dt?.maioria) { const req = soc.maioriaContratual || 75, v = Number(fd.votosAFavor) || 0; if (v > 0 && v < req) B.push(`Maioria insuficiente: ${v}% < ${req}% exigido (art. 265.º CSC).`); }
  if (did === "aumento_capital") {
    if (fd.aum_anterior_pendente === "sim") B.push("Aumento anterior não registado — bloqueado (art. 87.º, n.º 3 CSC).");
    if (fd.aum_prestacoes_falta === "sim") B.push("Prestações vencidas em falta — bloqueado (art. 87.º, n.º 4 CSC).");
    I.push("Art. 87.º CSC: deliberação deve conter modalidade, montante e prazos.");
  }
  if (did === "cessao_quotas") {
    if (fd.ces_consentimento_exigido === "sim" && fd.ces_consentimento_dado !== "sim") B.push("Consentimento exigido mas não concedido (art. 228.º CSC).");
    I.push("Art. 228.º CSC: forma escrita obrigatória.");
  }
  if (dt?.certAdm && !fd.cert_dispensado && !fd.cert_numero) W.push("Indicar número do certificado de admissibilidade ou marcar dispensa.");
  if (did === "dissolucao") I.push("Firma passará a conter 'em liquidação'.");
  return { B, W, I };
}

function computeEffects(selDel, fdMap) {
  const fx = { pacto: false, lista: false, registo: false, rcbe: false }; const docs = new Set(["Ata"]);
  selDel.forEach(did => {
    const dt = DELIB_TYPES.find(d => d.id === did); if (!dt) return;
    if (dt.pacto === true) fx.pacto = true;
    if (dt.lista === true) fx.lista = true;
    if (dt.registo === true) fx.registo = true;
    if (dt.rcbe === true) fx.rcbe = true;
    if (fx.pacto) docs.add("Pacto Social Atualizado");
    if (fx.lista) { docs.add("Lista de Sócios"); }
    if (fx.rcbe) docs.add("Atualização RCBE");
  });
  return { fx, docs: Array.from(docs) };
}

function NipcInput({ onSociedadeReady }) {
  const [nipc, setNipc] = useState("");
  const [soc, setSoc] = useState(null);
  const [mode, setMode] = useState("search");
  const [form, setForm] = useState({ firma: "", sede: "", tipo: "Sociedade por Quotas", capital: "", objeto: "", formaObrigar: "", numGerentes: "1", numSocios: "2", maioriaContratual: "" });
  const search = () => { const clean = nipc.replace(/[\s.]/g, ""); if (clean.length < 9) return; const found = findByNipc(clean); if (found) { setSoc(found); setMode("found"); onSociedadeReady(found); } else { setMode("create"); setForm(f => ({ ...f, nipc: clean })); } };
  const create = () => {
    const numS = Number(form.numSocios) || 2;
    const cap = Number(form.capital) || 0;
    const quotaPadrao = cap > 0 ? Math.floor(cap / numS) : 0;
    const socios = Array.from({ length: numS }, (_, i) => ({ id: String.fromCharCode(65 + i), quota: i === 0 ? cap - quotaPadrao * (numS - 1) : quotaPadrao, pct: i === 0 ? Math.round((cap - quotaPadrao * (numS - 1)) / cap * 100) : Math.round(quotaPadrao / cap * 100), penhor: false }));
    const newSoc = { nipc: form.nipc || nipc.replace(/[\s.]/g, ""), firma: form.firma, sede: form.sede, tipo: form.tipo, capital: cap, objeto: form.objeto, formaObrigar: form.formaObrigar || "A sociedade obriga-se com a intervenção de um gerente.", numGerentes: Number(form.numGerentes) || 1, socios, maioriaContratual: Number(form.maioriaContratual) || null };
    saveSociedade(newSoc); setSoc(newSoc); setMode("found"); onSociedadeReady(newSoc);
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
    </div>}
    {mode === "create" && <div>
      <Al type="info" title="Sociedade não encontrada">Preencha os dados públicos da sociedade.</Al>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Inp label="Firma" value={form.firma} onChange={v => setForm(f => ({ ...f, firma: v }))} required placeholder="Ex: Empresa, Lda." />
        <Sel label="Tipo" value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))} options={[{ v: "Sociedade por Quotas", l: "Sociedade por Quotas" }, { v: "Sociedade Unipessoal por Quotas", l: "Soc. Unipessoal por Quotas" }, { v: "Sociedade Anónima", l: "Sociedade Anónima" }]} />
        <Inp label="Sede" value={form.sede} onChange={v => setForm(f => ({ ...f, sede: v }))} required placeholder="Morada completa" style={{ gridColumn: "1/-1" }} />
        <Inp label="Capital Social (€)" value={form.capital} onChange={v => setForm(f => ({ ...f, capital: v }))} type="number" required />
        <Inp label="N.º Sócios" value={form.numSocios} onChange={v => setForm(f => ({ ...f, numSocios: v }))} type="number" required />
        <Inp label="Objeto Social" value={form.objeto} onChange={v => setForm(f => ({ ...f, objeto: v }))} style={{ gridColumn: "1/-1" }} />
        <Inp label="Forma de Obrigar" value={form.formaObrigar} onChange={v => setForm(f => ({ ...f, formaObrigar: v }))} style={{ gridColumn: "1/-1" }} />
        <Inp label="N.º Gerentes" value={form.numGerentes} onChange={v => setForm(f => ({ ...f, numGerentes: v }))} type="number" />
        <Inp label="Maioria contratual (%)" value={form.maioriaContratual} onChange={v => setForm(f => ({ ...f, maioriaContratual: v }))} type="number" placeholder="75" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Btn v="accent" onClick={create} disabled={!form.firma || !form.capital}>Guardar e Continuar</Btn>
      </div>
    </div>}
  </Cd>;
}

function CertAdmissibilidade({ fd, upd }) {
  return <div style={{ background: "#FFFBEB", borderRadius: 8, padding: 16, border: "1px solid #FDE68A", marginTop: 8 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 12 }}>Certificado de Admissibilidade</div>
    <Rad label="Necessita de certificado?" value={fd.cert_dispensado ? "nao" : "sim"} onChange={v => upd("cert_dispensado", v === "nao")} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Dispensado" }]} required />
    {!fd.cert_dispensado && <div style={{ marginTop: 12 }}><Inp label="N.º do Certificado" value={fd.cert_numero} onChange={v => upd("cert_numero", v)} required /></div>}
    {fd.cert_dispensado && <div style={{ marginTop: 12 }}><Sel label="Motivo de dispensa" value={fd.cert_motivo_dispensa_id} onChange={v => { upd("cert_motivo_dispensa_id", v); upd("cert_motivo_dispensa", CERT_DISPENSAS.find(c => c.id === v)?.l || ""); }} options={CERT_DISPENSAS.map(c => ({ v: c.id, l: c.l }))} required /></div>}
  </div>;
}

function SociedadesView() {
  const [socs, setSocs] = useState([]);
  useEffect(() => { setSocs(loadSociedades()); }, []);
  return <div>
    <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Sociedades</h1>
    <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 20px" }}>Dados públicos guardados localmente</p>
    {socs.length === 0 ? <Cd><p style={{ color: CL.gr, textAlign: "center", padding: "40px 0" }}>Sem sociedades registadas.</p></Cd> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
        {socs.map((soc, i) => <Cd key={i}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: CL.d, marginBottom: 4 }}>{soc.firma}</div>
            <div style={{ fontSize: 12, color: CL.gr }}>NIPC: {soc.nipc} · {soc.tipo}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            <div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Capital</div><div style={{ fontWeight: 600 }}>{fmt(soc.capital)}</div></div>
            <div><div style={{ color: CL.gr, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Sócios</div><div style={{ fontWeight: 600 }}>{soc.socios?.length || 0}</div></div>
          </div>
        </Cd>)}
      </div>}
  </div>;
}

function Wizard({ onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [soc, setSoc] = useState(null);
  const [selDel, setSelDel] = useState([]);
  const [fdMap, setFdMap] = useState({});
  const [downloading, setDownloading] = useState(false);
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
      else alert(`"${docName}" — em desenvolvimento.`);
    } catch (e) { console.error(e); alert("Erro: " + e.message); }
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
          <Inp label="Capital Atual" value={fmt(soc?.capital)} disabled />
          <Inp label="Montante" value={fd.aum_montante} onChange={v => u("aum_montante", v)} type="number" required />
          <Inp label="Novo Capital" value={fd.aum_montante ? fmt((soc?.capital || 0) + Number(fd.aum_montante)) : ""} disabled />
        </div>
        <Rad label="Aumento anterior pendente?" value={fd.aum_anterior_pendente} onChange={v => u("aum_anterior_pendente", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />
        <Rad label="Prestações vencidas em falta?" value={fd.aum_prestacoes_falta} onChange={v => u("aum_prestacoes_falta", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />
        <Rad label="Realização integral?" value={fd.aum_realizacao_integral} onChange={v => u("aum_realizacao_integral", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} />
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}
      {did === "cessao_quotas" && <>
        <Sel label="Subtipo" value={fd.ces_sub} onChange={v => u("ces_sub", v)} options={CESSAO_SUBS.map(s => ({ v: s.id, l: s.l }))} required />
        <Rad label="Total/parcial?" value={fd.ces_tipo} onChange={v => u("ces_tipo", v)} options={[{ v: "total", l: "Total" }, { v: "parcial", l: "Parcial" }]} required />
        {fd.ces_tipo === "parcial" && <Inp label="Valor da parte cedida" value={fd.ces_vn} onChange={v => u("ces_vn", v)} type="number" required />}
        <Rad label="Consentimento exigido?" value={fd.ces_consentimento_exigido} onChange={v => u("ces_consentimento_exigido", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} required />
        {fd.ces_consentimento_exigido === "sim" && <Rad label="Consentimento dado?" value={fd.ces_consentimento_dado} onChange={v => u("ces_consentimento_dado", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Recusa" }]} required />}
      </>}
      {["alteracao_firma", "alteracao_sede", "alteracao_objeto"].includes(did) && <>
        <Inp label="Texto atual" value={did === "alteracao_firma" ? soc?.firma : did === "alteracao_sede" ? soc?.sede : soc?.objeto} disabled />
        <Inp label="Novo texto" value={fd.novo_texto} onChange={v => u("novo_texto", v)} required />
        <CertAdmissibilidade fd={fd} upd={u} />
        <Inp label="Votos a favor (%)" value={fd.votosAFavor} onChange={v => u("votosAFavor", v)} type="number" required placeholder="100" />
      </>}
      {did === "aprovacao_contas" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Inp label="Exercício" value={fd.ct_exercicio} onChange={v => u("ct_exercicio", v)} placeholder="2025" required />
          <Inp label="Resultado Líquido" value={fd.ct_resultado} onChange={v => u("ct_resultado", v)} type="number" required />
        </div>
        <Rad label="Decisão" value={fd.ct_decisao} onChange={v => u("ct_decisao", v)} options={[{ v: "aprovadas", l: "Aprovadas" }, { v: "nao", l: "Não aprovadas" }]} required />
      </>}
      {did === "distribuicao_lucros" && <Inp label="Montante total" value={fd.dl_total} onChange={v => u("dl_total", v)} type="number" required />}
      {did === "nomeacao_gerente" && <Al type="privacy">Dados do gerente em placeholders.</Al>}
      {did === "destituicao_gerente" && <Rad label="Justa causa?" value={fd.dest_justa_causa} onChange={v => u("dest_justa_causa", v)} options={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} />}
      {did === "dissolucao" && <Inp label="Fundamento" value={fd.dis_fund} onChange={v => u("dis_fund", v)} required />}
    </div>;
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Nova Deliberação</h1>
      <Btn v="ghost" onClick={onCancel}>✕</Btn>
    </div>
    {step === 0 && <div><NipcInput onSociedadeReady={setSoc} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}><Btn disabled={!soc} onClick={() => setStep(1)}>Continuar →</Btn></div></div>}
    {step === 1 && <div>
      <Cd style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: CL.d, margin: "0 0 20px" }}>Deliberações</h3>
        {Object.entries(CATS).map(([cid, cl]) => {
          const items = DELIB_TYPES.filter(d => d.cat === cid);
          return <div key={cid} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>{cl}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {items.map(d => {
                const sel = selDel.includes(d.id);
                return <div key={d.id} onClick={() => togDel(d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, cursor: "pointer", border: sel ? `2px solid ${CL.d}` : "1px solid #E5E7EB", background: sel ? "#F0F4FF" : "#fff" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? "none" : "2px solid #D1D5DB", background: sel ? CL.d : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : ""}</div>
                  <div style={{ fontSize: 13, fontWeight: sel ? 600 : 500 }}><span style={{ marginRight: 6, opacity: 0.5 }}>{d.icon}</span>{d.label}</div>
                </div>;
              })}
            </div>
          </div>;
        })}
      </Cd>
      <div style={{ display: "flex", justifyContent: "space-between" }}><Btn v="secondary" onClick={() => setStep(0)}>← Voltar</Btn><Btn disabled={selDel.length === 0} onClick={() => setStep(2)}>Continuar →</Btn></div>
    </div>}
    {step === 2 && <div>
      {selDel.map(did => { const dt = DELIB_TYPES.find(d => d.id === did); return <Cd key={did} style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>{dt?.icon} {dt?.label}</h3>
        {renderForm(did)}
      </Cd>; })}
      <div style={{ display: "flex", justifyContent: "space-between" }}><Btn v="secondary" onClick={() => setStep(1)}>← Voltar</Btn><Btn disabled={hasBlock} onClick={() => setStep(3)}>{hasBlock ? "Bloqueios ⛔" : "Documentos →"}</Btn></div>
    </div>}
    {step === 3 && <Cd style={{ textAlign: "center", padding: "48px 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4", border: "2px solid #22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✓</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Playfair Display',serif" }}>Documentos Prontos</h2>
      <p style={{ fontSize: 14, color: CL.gr, margin: "0 0 32px" }}>{soc?.firma}</p>
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "left" }}>
        {docs.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 8, marginBottom: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>📄 {d}</span>
          <Btn v="accent" size="sm" onClick={() => handleDownload(d)} disabled={downloading}>{downloading ? "..." : "DOCX ↓"}</Btn>
        </div>)}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
        <Btn v="secondary" onClick={() => setStep(2)}>← Rever</Btn>
        <Btn v="accent" onClick={onDone}>Concluir</Btn>
      </div>
    </Cd>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO OPERAÇÕES M&A — Wizard dinâmico → Pacote para Claude.ai
// ═══════════════════════════════════════════════════════════════════════

// ── TEMPLATES DE CASOS ────────────────────────────────────────────────

const OP_TEMPLATES = [
  {
    id: "venda_restaurante",
    label: "Venda de restaurante + imóvel",
    icon: "🍽️",
    description: "Família vende restaurante (Lda) e imóvel onde funciona (SA)",
    data: {
      op_titulo: "Venda Restaurante + Imóvel",
      op_lado: "vendedor",
      op_objetivo: "Vender restaurante e imóvel onde funciona",
      op_prazo: "6 meses",
      op_valor: "1500000",
      soc_num: "2",
      soc_lista: "Restaurante O Forno, Lda — restauração, capital 50.000€\nImobiliária Silva, SA — imobiliária, capital 50.000€",
      ativos_imoveis: "sim",
      ativos_imoveis_detalhe: "Loja onde funciona o restaurante: VPT 800.000€, valor mercado 1.200.000€, hipoteca 350.000€",
      trab_total: "15",
      fam_relacoes: "sim",
    }
  },
  {
    id: "holding_familiar",
    label: "Criação de holding familiar",
    icon: "🏛️",
    description: "Reorganização de grupo familiar com criação de holding",
    data: {
      op_titulo: "Criação Holding Familiar",
      op_lado: "reorganizacao",
      op_objetivo: "Criar holding familiar para reorganizar grupo e preparar sucessão",
      op_tipo_op: "holding",
      soc_num: "3",
      fam_relacoes: "sim",
      fam_sucessao: "sim",
    }
  },
  {
    id: "doacao_quotas",
    label: "Doação de quotas a filhos",
    icon: "👨‍👧",
    description: "Pai pretende doar quotas aos filhos com isenção de IS",
    data: {
      op_titulo: "Doação de Quotas a Filhos",
      op_lado: "reorganizacao",
      op_objetivo: "Transmissão gratuita de quotas em vida com aproveitamento de isenção fiscal",
      op_tipo_op: "doacao",
      fam_relacoes: "sim",
      fam_transmissao_gratuita: "sim",
      fam_parentesco: "descendente",
      fam_sucessao: "sim",
    }
  },
];

// ── CRUZAMENTOS JURÍDICOS AUTOMÁTICOS ─────────────────────────────────
// Cada cruzamento avalia os dados e devolve um alerta se for relevante

function detectCrossings(data) {
  const crossings = [];

  // 1. Doação de quotas → Imposto do Selo (com cálculo)
  if (data.fam_transmissao_gratuita === "sim") {
    const valor = Number(data.fam_valor_estimado) || 0;
    const parentesco = data.fam_parentesco;
    if (parentesco === "conjuge" || parentesco === "descendente" || parentesco === "ascendente") {
      crossings.push({
        id: "doacao_isenta",
        type: "fiscal",
        severity: "info",
        title: "Doação de quotas — ISENTA de Imposto do Selo (art. 6.º, n.º 1, al. e) CIS)",
        ref: "CIS art. 1.º n.º 3 al. c) + art. 6.º n.º 1 al. e); Manual secção 1.18",
        text: `Transmissão gratuita de quotas sujeita à verba 1.2 da Tabela Geral do CIS. Sendo o beneficiário ${parentesco === "conjuge" ? "cônjuge/unido de facto" : parentesco === "descendente" ? "descendente direto" : "ascendente direto"}, beneficia de isenção nos termos do art. 6.º, n.º 1, al. e) CIS.${valor > 0 ? ` Valor estimado: ${fmt(valor)}. Imposto a pagar: ${fmt(0)}.` : ""} ⚠ A VALIDAR COM FISCALISTA.`
      });
    } else if (parentesco === "terceiro" || parentesco === "outro_familiar") {
      const imposto = Math.round(valor * 0.10);
      crossings.push({
        id: "doacao_tributada",
        type: "fiscal",
        severity: "warn",
        title: "Doação de quotas — SUJEITA a Imposto do Selo (taxa 10%)",
        ref: "CIS art. 1.º n.º 3 al. c); verba 1.2 Tabela Geral",
        text: `Transmissão gratuita sujeita à verba 1.2 CIS. NÃO se aplica isenção do art. 6.º CIS — beneficiário não é cônjuge/descendente/ascendente. Taxa: 10% sobre o valor.${valor > 0 ? ` Valor estimado: ${fmt(valor)}. Imposto a pagar: ${fmt(imposto)}.` : ""} ⚠ A VALIDAR COM FISCALISTA.`
      });
    } else if (parentesco) {
      crossings.push({
        id: "doacao_pendente",
        type: "warning",
        severity: "warn",
        title: "Doação identificada — falta indicar parentesco",
        ref: "Bloco E",
        text: "Indique o grau de parentesco entre doador e beneficiário para avaliar isenção de IS."
      });
    }
  }

  // 2. Permuta de participações → Neutralidade fiscal (CIRC arts. 73.º, 77.º)
  if (data.op_tipo_op === "holding" || data.op_tipo_op === "permuta") {
    crossings.push({
      id: "permuta_neutralidade",
      type: "fiscal",
      severity: "info",
      title: "Permuta de participações — avaliar regime de neutralidade fiscal",
      ref: "CIRC arts. 73.º n.º 5 e 77.º; Manual secções 2.7, 2.14, 2.15",
      text: "Operação candidata a permuta de partes sociais com regime especial de neutralidade fiscal em IRC. Requisitos: sociedades residentes em PT/UE, aquisição de maioria dos direitos de voto pela adquirente, finalidade económica válida (reorganização). No relatório: gerar Cenário 1 (neutralidade) vs Cenário 2 (regime geral com mais-valias). ⚠ A VALIDAR COM FISCALISTA."
    });
  }

  // 3. Cisão / Fusão / Entrada de ativos → Regime especial vs geral
  if (data.op_tipo_op === "cisao" || data.op_tipo_op === "fusao" || data.op_tipo_op === "entrada_ativos") {
    const tipo = { cisao: "Cisão", fusao: "Fusão", entrada_ativos: "Entrada de ativos" }[data.op_tipo_op];
    crossings.push({
      id: "regime_especial",
      type: "fiscal",
      severity: "info",
      title: `${tipo} — regime especial vs regime geral`,
      ref: "CIRC arts. 73.º a 78.º; Manual secção 4 (cisão)",
      text: `${tipo} identificada (definição no art. 73.º CIRC). Pode beneficiar do regime especial de neutralidade fiscal se cumpridos os requisitos. Atenção especial ao conceito de "ramo de atividade" (jurisprudência exigente — risco de antiabuso quando há "imóveis mortos" ou ramos artificiais). Gerar cenários comparativos. ⚠ A VALIDAR COM FISCALISTA.`
    });
  }

  // 4. Transmissão de estabelecimento com trabalhadores → Laboral
  const numTrab = Number(String(data.trab_total || "").replace(/\D/g, "")) || 0;
  if (numTrab > 0 && (data.op_tipo_op === "trespasse" || data.op_tipo_op === "asset_deal" || data.op_tem_estab === "sim" || data.op_lado === "vendedor")) {
    crossings.push({
      id: "transmissao_laboral",
      type: "legal",
      severity: "warn",
      title: "Transmissão de estabelecimento — efeitos laborais (arts. 285.º e 286.º CT)",
      ref: "CT arts. 285.º e 286.º",
      text: `${numTrab} trabalhador(es) afetado(s). Efeitos automáticos: (1) Transmissão automática da posição de empregador (art. 285.º n.º 1); (2) Manutenção de TODOS os direitos — retribuição, antiguidade, categoria (art. 285.º n.º 3); (3) Responsabilidade SOLIDÁRIA do transmitente por créditos vencidos durante 2 anos (art. 285.º n.º 6); (4) OBRIGAÇÃO de informação por escrito aos representantes dos trabalhadores, mínimo 10 dias úteis antes (art. 286.º n.º 1 e 3).`
    });
  }

  // 5. Imóveis → IMT, IS, segregação patrimonial
  if (data.ativos_imoveis === "sim") {
    crossings.push({
      id: "imoveis_segregacao",
      type: "fiscal",
      severity: "info",
      title: "Ativos imobiliários — IMT, IS e segregação patrimonial",
      ref: "CIMT art. 2.º n.º 2 al. d); EBF art. 60.º",
      text: "Imóveis identificados. Avaliar: (1) Incidência de IMT na transmissão direta; (2) Cláusula anti-abuso CIMT — cessão de quotas em sociedade com ativo maioritariamente imobiliário pode ser equiparada a transmissão de imóvel (art. 2.º n.º 2 al. d) CIMT); (3) Possível isenção de IMT em reorganização empresarial (art. 60.º EBF); (4) Segregação numa sociedade dedicada para proteção patrimonial. ⚠ A VALIDAR COM FISCALISTA."
    });
  }

  // 6. Hipoteca sobre imóvel a transmitir → autorização bancária
  if (data.ativos_imoveis === "sim" && data.ativos_hipoteca === "sim") {
    crossings.push({
      id: "hipoteca",
      type: "warning",
      severity: "warn",
      title: "Hipoteca sobre imóvel — autorização bancária necessária",
      ref: "CC arts. 686.º e ss.",
      text: "Imóvel hipotecado a transmitir. Necessária autorização do banco credor. Possível reembolso antecipado obrigatório com penalizações. Considerar timing da operação face às condições do contrato de mútuo."
    });
  }

  // 7. Penhoras / ónus sobre quotas
  if (data.fin_penhoras === "sim") {
    crossings.push({
      id: "penhoras",
      type: "block",
      severity: "block",
      title: "Penhoras/ónus sobre quotas — BLOQUEANTE",
      ref: "CSC art. 23.º; CPC arts. 781.º e ss.",
      text: "Identificadas penhoras ou ónus sobre quotas. ANTES de qualquer transmissão verificar: (1) Se a penhora impede a cessão; (2) Notificação obrigatória ao credor pignoratício; (3) Eventual necessidade de autorização judicial. Pode ser BLOQUEANTE."
    });
  }

  // 8. Acordos parassociais com cláusulas restritivas
  if (data.soc_parassociais === "sim") {
    crossings.push({
      id: "parassociais",
      type: "legal",
      severity: "warn",
      title: "Acordos parassociais — verificar cláusulas restritivas",
      ref: "CSC art. 17.º",
      text: "Acordo parassocial identificado. Verificar: (1) Direitos de preferência (ROFR/ROFO); (2) Cláusulas de consentimento prévio; (3) Lock-up; (4) Tag-along/Drag-along; (5) Quóruns especiais. Estas cláusulas podem condicionar ou bloquear a operação."
    });
  }

  // 9. Sucessão / planeamento patrimonial
  if (data.fam_sucessao === "sim") {
    crossings.push({
      id: "sucessao",
      type: "suggestion",
      severity: "info",
      title: "Planeamento sucessório — explorar transmissão em vida",
      ref: "CIS art. 6.º; CC arts. 2024.º e ss.",
      text: "Planeamento sucessório identificado. Avaliar trade-off: transmissão em vida (doação com possível isenção de IS se descendentes) vs transmissão mortis causa (também isenta se descendentes, mas perde-se controlo). Considerar criação de holding familiar para continuidade geracional e governance."
    });
  }

  // 10. Share deal → Due diligence
  if (data.op_tipo_op === "share_deal" || data.op_lado === "comprador") {
    crossings.push({
      id: "dd_share",
      type: "legal",
      severity: "info",
      title: "Share deal — due diligence obrigatória",
      ref: "Best practice M&A; Manual Parte V",
      text: "Operação de share deal. Obrigatório realizar DD: (1) Societária — certidão comercial, pacto, atas, parassociais, penhoras; (2) Imobiliária se imóveis; (3) Laboral — mapa pessoal, IRCT, litígios; (4) Fiscal — situação contributiva, processos AT; (5) Contratual — fornecedores críticos, change of control. Negociar: reps & warranties, indemnização (cap, basket), escrow, MAC, não concorrência."
    });
  }

  // 11. Dois lados (vendedor + ativo de outra sociedade) → Operação multi-sociedade complexa
  if (data.soc_num && Number(data.soc_num) >= 2 && data.ativos_imoveis === "sim") {
    crossings.push({
      id: "multi_sociedade",
      type: "suggestion",
      severity: "info",
      title: "Operação multi-sociedade com imóveis — múltiplos cenários a explorar",
      ref: "Estruturação M&A complexa",
      text: "Caso envolve várias sociedades e imóveis. Cenários típicos a explorar no relatório: (a) Asset deal puro; (b) Share deal puro de cada sociedade; (c) Cisão prévia para isolar ativos relevantes; (d) Reorganização prévia (criação de holding) antes da venda; (e) Trespasse + venda separada de imóvel; (f) Sale-and-leaseback intermédio; (g) Vendor loan (venda em fases). Cada cenário com timing, custo fiscal e riscos distintos."
    });
  }

  // 12. Sociedade SA → cuidados específicos
  if (data.soc_lista && data.soc_lista.toLowerCase().includes("sa") && !data.soc_lista.toLowerCase().includes("salvo")) {
    crossings.push({
      id: "sa_especificidades",
      type: "legal",
      severity: "info",
      title: "Sociedade Anónima envolvida — cuidados específicos",
      ref: "CSC arts. 271.º e ss.",
      text: "SA identificada. Verificar: (1) Tipo de ações (nominativas/escriturais/ao portador); (2) Órgãos sociais (conselho de administração, fiscal único, ROC); (3) Eventuais regras estatutárias sobre transmissão de ações; (4) Em SA com ações ao portador — dever de identificação dos titulares (Lei 15/2017)."
    });
  }

  // 13. Sociedade com prejuízos fiscais → reporte
  if (data.fin_prejuizos === "sim") {
    crossings.push({
      id: "prejuizos",
      type: "fiscal",
      severity: "warn",
      title: "Prejuízos fiscais reportáveis — atenção em reorganização",
      ref: "CIRC art. 52.º; arts. 75.º e 75.º-A CIRC",
      text: "Sociedade com prejuízos fiscais. Em caso de fusão/cisão, a transmissão de prejuízos para a sociedade beneficiária está sujeita a autorização da AT (art. 75.º CIRC) e a requisitos restritivos. Em alteração de objeto social ou de titularidade pode haver caducidade. ⚠ A VALIDAR COM FISCALISTA."
    });
  }

  // 14. Dívidas fiscais → certidão de não dívida
  if (data.fin_dividas === "sim") {
    crossings.push({
      id: "dividas",
      type: "warning",
      severity: "warn",
      title: "Dívidas relevantes — verificar certidões",
      ref: "Best practice DD",
      text: "Dívidas identificadas. Antes do closing: (1) Obter certidão de não dívida AT; (2) Certidão SS; (3) Verificar dívidas bancárias e covenants; (4) Verificar se há cláusulas de change of control nos contratos de financiamento; (5) Avaliar impacto no preço (debt-free, cash-free) ou retenção em escrow."
    });
  }

  return crossings;
}

// ── DEFINIÇÃO DOS BLOCOS DO QUESTIONÁRIO (DINÂMICOS) ──────────────────

function getBlocks(data) {
  const blocks = [];

  // BLOCO A — Contexto e objetivo
  const A = {
    id: "A", title: "Contexto e objetivo", icon: "🎯",
    questions: [
      { id: "op_titulo", label: "Título da operação", type: "text", placeholder: "Ex: Venda Restaurante O Forno" },
      { id: "op_lado", label: "Quem é o cliente?", type: "radio", options: [
        { v: "vendedor", l: "Vendedor" },
        { v: "comprador", l: "Comprador" },
        { v: "ambos", l: "Ambos" },
        { v: "reorganizacao", l: "Reorganização interna (sem M&A)" },
      ]},
      { id: "op_tipo_op", label: "Tipo de operação principal", type: "select", options: [
        { v: "share_deal", l: "Compra/venda de quotas (share deal)" },
        { v: "asset_deal", l: "Compra/venda de ativos (asset deal)" },
        { v: "trespasse", l: "Trespasse de estabelecimento" },
        { v: "holding", l: "Criação de holding" },
        { v: "permuta", l: "Permuta de participações" },
        { v: "fusao", l: "Fusão" },
        { v: "cisao", l: "Cisão" },
        { v: "entrada_ativos", l: "Entrada de ativos" },
        { v: "doacao", l: "Doação de quotas" },
        { v: "sucessao", l: "Planeamento sucessório" },
        { v: "mista", l: "Operação mista / multi-fase" },
      ]},
      { id: "op_objetivo", label: "Objetivo principal (1-2 linhas)", type: "textarea", rows: 2, placeholder: "Ex: Vender restaurante e imóvel onde funciona, maximizando valor líquido para o vendedor" },
      { id: "op_prazo", label: "Prazo pretendido", type: "text", placeholder: "Ex: 6 meses" },
      { id: "op_valor", label: "Valor aproximado da operação (€)", type: "number", placeholder: "Ex: 1500000" },
      { id: "op_obs_A", label: "Observações adicionais (Bloco A)", type: "textarea", rows: 2, hint: "Informação livre que considere relevante para este bloco" },
    ]
  };
  blocks.push(A);

  // BLOCO B — Sociedades envolvidas
  const B = {
    id: "B", title: "Sociedades envolvidas", icon: "🏢",
    questions: [
      { id: "soc_num", label: "Quantas sociedades estão envolvidas?", type: "select", options: [
        { v: "1", l: "1 sociedade" }, { v: "2", l: "2 sociedades" }, { v: "3", l: "3 sociedades" },
        { v: "4", l: "4 sociedades" }, { v: "5+", l: "5 ou mais" }
      ]},
      { id: "soc_lista", label: "Listagem das sociedades (firma, NIPC, tipo, sede)", type: "textarea", rows: 4, placeholder: "Soc. 1: Restaurante O Forno, Lda — NIPC 510123456 — Lda — Lisboa\nSoc. 2: Imobiliária Silva, SA — NIPC 510987654 — SA — Lisboa" },
      { id: "soc_capitais", label: "Capital social de cada sociedade", type: "textarea", rows: 2, placeholder: "Soc. 1: 50.000€\nSoc. 2: 50.000€" },
      { id: "soc_socios", label: "Sócios e percentagens (por sociedade)", type: "textarea", rows: 3, placeholder: "Soc. 1: Pai 60% + Filho 40%\nSoc. 2: Pai 100%" },
      { id: "soc_residencia", label: "Residência fiscal das sociedades", type: "radio", options: [
        { v: "pt", l: "Todas em Portugal" }, { v: "ue", l: "Portugal + UE" }, { v: "fora", l: "Há fora da UE" }
      ]},
      { id: "soc_parassociais", label: "Existem acordos parassociais?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "desconhecido", l: "Desconhecido" }] },
      { id: "soc_obs_B", label: "Observações (Bloco B)", type: "textarea", rows: 2, hint: "Detalhes específicos sobre as sociedades, gerência, órgãos sociais, etc." },
    ]
  };
  // Condicional: se há parassociais, perguntar detalhes
  if (data.soc_parassociais === "sim") {
    B.questions.push({ id: "soc_parassociais_detalhe", label: "Cláusulas relevantes do acordo parassocial", type: "textarea", rows: 2, placeholder: "Lock-up, ROFR, tag-along, drag-along, deadlock..." });
  }
  blocks.push(B);

  // BLOCO C — Atividades e contratos
  blocks.push({
    id: "C", title: "Atividades e contratos", icon: "📊",
    questions: [
      { id: "neg_descricao", label: "Atividade de cada sociedade", type: "textarea", rows: 2, placeholder: "Soc. 1: Restauração\nSoc. 2: Gestão imobiliária" },
      { id: "neg_volume", label: "Volume de negócios anual aproximado", type: "textarea", rows: 2, placeholder: "Soc. 1: ~800.000€\nSoc. 2: ~120.000€" },
      { id: "neg_contratos_relevantes", label: "Existem contratos críticos?", type: "checkboxes", options: [
        { v: "arrendamento", l: "Arrendamento" }, { v: "franchising", l: "Franchising" },
        { v: "fornecedor_chave", l: "Fornecedor-chave" }, { v: "licenca_setorial", l: "Licença setorial" },
        { v: "leasing", l: "Leasing" }, { v: "financiamento", l: "Financiamento bancário" },
      ]},
      { id: "neg_contratos_detalhe", label: "Detalhe dos contratos críticos", type: "textarea", rows: 2, placeholder: "Ex: Arrendamento da loja com renda 3.000€/mês, leasing equipamento cozinha 3 anos remanescentes" },
      { id: "neg_obs_C", label: "Observações (Bloco C)", type: "textarea", rows: 2, hint: "Cláusulas change of control, fornecedores estratégicos, etc." },
    ]
  });

  // BLOCO D — Ativos
  const D = {
    id: "D", title: "Ativos", icon: "🏠",
    questions: [
      { id: "ativos_imoveis", label: "Existem imóveis na operação?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
    ]
  };
  if (data.ativos_imoveis === "sim") {
    D.questions.push(
      { id: "ativos_imoveis_num", label: "Quantos imóveis?", type: "select", options: [{ v: "1", l: "1" }, { v: "2", l: "2" }, { v: "3", l: "3" }, { v: "4+", l: "4 ou mais" }] },
      { id: "ativos_imoveis_detalhe", label: "Descrição dos imóveis (proprietário, VPT, valor mercado)", type: "textarea", rows: 3, placeholder: "Imóvel 1: Loja restaurante, Imobiliária SA, VPT 800.000€, valor mercado 1.200.000€" },
      { id: "ativos_hipoteca", label: "Existem hipotecas sobre os imóveis?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
    );
    if (data.ativos_hipoteca === "sim") {
      D.questions.push({ id: "ativos_hipoteca_detalhe", label: "Detalhe das hipotecas (banco, valor em dívida)", type: "textarea", rows: 2, placeholder: "Banco X, 350.000€ em dívida, prazo restante 12 anos" });
    }
  }
  D.questions.push(
    { id: "op_tem_estab", label: "Existe(m) estabelecimento(s) comercial(ais)?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
  );
  if (data.op_tem_estab === "sim") {
    D.questions.push({ id: "estab_detalhe", label: "Detalhe do estabelecimento (alvará, licenças, afetação)", type: "textarea", rows: 2 });
  }
  D.questions.push(
    { id: "ativos_outros", label: "Outros ativos relevantes", type: "checkboxes", options: [
      { v: "marcas", l: "Marcas" }, { v: "patentes", l: "Patentes" }, { v: "software", l: "Software" },
      { v: "equipamento", l: "Equipamento valioso" }, { v: "stock", l: "Stock relevante" },
    ]},
    { id: "ativos_obs_D", label: "Observações (Bloco D)", type: "textarea", rows: 2, hint: "Detalhes sobre ativos, leasings, ónus, etc." },
  );
  blocks.push(D);

  // BLOCO E — Pessoas, família, transmissões gratuitas
  const E = {
    id: "E", title: "Pessoas e família", icon: "👥",
    questions: [
      { id: "fam_relacoes", label: "Existem relações familiares entre sócios/partes?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
    ]
  };
  if (data.fam_relacoes === "sim") {
    E.questions.push({ id: "fam_detalhe", label: "Descrição das relações familiares", type: "textarea", rows: 2, placeholder: "Sócio A é pai do Sócio B. Cônjuge do Sócio A detém a SA imobiliária." });
  }
  E.questions.push({ id: "fam_transmissao_gratuita", label: "Há transmissão gratuita prevista (doação)?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] });
  if (data.fam_transmissao_gratuita === "sim") {
    E.questions.push(
      { id: "fam_o_que", label: "O que vai ser doado?", type: "select", options: [{ v: "quotas", l: "Quotas/ações" }, { v: "estabelecimento", l: "Estabelecimento" }, { v: "imovel", l: "Imóvel" }, { v: "outro", l: "Outro" }] },
      { id: "fam_doador", label: "Doador (1-2 linhas)", type: "text", placeholder: "Ex: Pai (Sócio A)" },
      { id: "fam_donatario", label: "Donatário (1-2 linhas)", type: "text", placeholder: "Ex: Filho (Sócio B)" },
      { id: "fam_parentesco", label: "Grau de parentesco doador→donatário", type: "select", options: [
        { v: "conjuge", l: "Cônjuge ou unido de facto" },
        { v: "descendente", l: "Descendente direto (filho, neto)" },
        { v: "ascendente", l: "Ascendente direto (pai, avô)" },
        { v: "outro_familiar", l: "Outro familiar (irmão, sobrinho, etc.)" },
        { v: "terceiro", l: "Terceiro sem parentesco" },
      ]},
      { id: "fam_valor_estimado", label: "Valor estimado da doação (€)", type: "number", placeholder: "Ex: 100000" },
    );
  }
  E.questions.push(
    { id: "fam_sucessao", label: "Há planeamento sucessório envolvido?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
    { id: "fam_obs_E", label: "Observações (Bloco E)", type: "textarea", rows: 2, hint: "Outras informações familiares ou sucessórias relevantes" },
  );
  blocks.push(E);

  // BLOCO F — Situação financeira
  blocks.push({
    id: "F", title: "Situação financeira", icon: "⚖️",
    questions: [
      { id: "fin_dividas", label: "Existem dívidas relevantes?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
      ...(data.fin_dividas === "sim" ? [{ id: "fin_dividas_detalhe", label: "Detalhe das dívidas", type: "textarea", rows: 2, placeholder: "Banco X 200.000€; AT 15.000€; suprimentos sócios 50.000€" }] : []),
      { id: "fin_litigios", label: "Existem litígios pendentes?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
      ...(data.fin_litigios === "sim" ? [{ id: "fin_litigios_detalhe", label: "Detalhe dos litígios", type: "textarea", rows: 2 }] : []),
      { id: "fin_penhoras", label: "Existem penhoras/ónus sobre quotas ou bens?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
      ...(data.fin_penhoras === "sim" ? [{ id: "fin_penhoras_detalhe", label: "Detalhe das penhoras/ónus", type: "textarea", rows: 2 }] : []),
      { id: "fin_prejuizos", label: "Há prejuízos fiscais reportáveis?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "desconhecido", l: "Desconhecido" }] },
      { id: "fin_obs_F", label: "Observações (Bloco F)", type: "textarea", rows: 2, hint: "Covenants bancários, garantias prestadas, situação contributiva, etc." },
    ]
  });

  // BLOCO G — Trabalhadores
  blocks.push({
    id: "G", title: "Trabalhadores", icon: "👷",
    questions: [
      { id: "trab_total", label: "Número total de trabalhadores", type: "number", placeholder: "Ex: 15" },
      ...(Number(data.trab_total) > 0 ? [
        { id: "trab_afetacao", label: "Afetação dos trabalhadores", type: "textarea", rows: 2, placeholder: "12 afetos ao restaurante, 3 à gestão administrativa" },
        { id: "trab_irct", label: "Existe IRCT aplicável?", type: "text", placeholder: "Ex: CCT setor restauração" },
        { id: "trab_litigios", label: "Existem litígios laborais pendentes?", type: "radio", options: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
      ] : []),
      { id: "trab_obs_G", label: "Observações (Bloco G)", type: "textarea", rows: 2, hint: "Outsourcing, estágios, baixas longas, situações especiais" },
    ]
  });

  // BLOCO H — Intenções das partes
  blocks.push({
    id: "H", title: "Intenções das partes", icon: "🎯",
    questions: [
      { id: "int_vendedor", label: "O que pretende o vendedor?", type: "textarea", rows: 2, placeholder: "Sair totalmente; manter alguns ativos; valor mínimo 1M€; preferência por neutralidade fiscal" },
      ...(data.op_lado === "comprador" || data.op_lado === "ambos" ? [
        { id: "int_comprador", label: "O que pretende o comprador?", type: "textarea", rows: 2, placeholder: "Adquirir restaurante + imóvel; sem trabalhadores; closing rápido" },
      ] : []),
      { id: "int_dealbreakers", label: "Existem 'deal-breakers' conhecidos?", type: "textarea", rows: 2, placeholder: "Vendedor não aceita earn-out; comprador exige escrow de 200.000€" },
      { id: "int_obs_H", label: "Observações (Bloco H)", type: "textarea", rows: 2, hint: "Outras intenções relevantes" },
    ]
  });

  // BLOCO I — Restrições e preferências
  blocks.push({
    id: "I", title: "Restrições e preferências", icon: "🚧",
    questions: [
      { id: "rest_evitar", label: "O cliente quer evitar alguma operação?", type: "checkboxes", options: [
        { v: "cisao", l: "Cisão" }, { v: "fusao", l: "Fusão" }, { v: "neutralidade", l: "Neutralidade fiscal" },
        { v: "earnout", l: "Earn-out" }, { v: "vendor_loan", l: "Vendor loan" }, { v: "escrow", l: "Escrow" },
      ]},
      { id: "rest_prefere", label: "Preferências expressas pelo cliente", type: "textarea", rows: 2, placeholder: "Prefere closing rápido; quer manter discrição; quer minimizar custos notariais" },
      { id: "rest_orcamento", label: "Orçamento disponível para custos da operação", type: "text", placeholder: "Ex: até 20.000€ em custos jurídicos+notariais" },
      { id: "rest_obs_I", label: "Observações (Bloco I)", type: "textarea", rows: 2, hint: "Outras restrições, preferências, ou contexto estratégico" },
    ]
  });

  return blocks;
}

// ── GERADOR DE PROMPT PARA CLAUDE.AI ──────────────────────────────────

function generateClaudePrompt(data, blocks, crossings) {
  const lines = [];
  lines.push("# RELATÓRIO DE REORGANIZAÇÃO SOCIETÁRIA / M&A");
  lines.push("");
  lines.push("## PAPEL E CONTEXTO");
  lines.push("");
  lines.push("Atua como uma IA jurídica avançada, a operar em PORTUGAL, especializada em Direito Societário e M&A. Vais ajudar-me a estruturar uma operação complexa para um cliente da P&A Legal. Tens acesso ao MANUAL OPERACIONAL anexo (que deves consultar quando fizer sentido). O resultado deve ter qualidade de parecer de honorário > €50.000.");
  lines.push("");
  lines.push("**Regras absolutas:**");
  lines.push("- Não inventes artigos nem normas. Se não souberes o número exato, indica apenas o nome do código.");
  lines.push("- Sempre que abordares matéria fiscal, inclui no fim da secção: **⚠ A VALIDAR COM O FISCALISTA**.");
  lines.push("- Apresenta SEMPRE múltiplos cenários (mínimo 5 distintos), não impõe uma única solução.");
  lines.push("- Para cada cenário: descrição passo a passo, timing, custo fiscal calculado com NÚMEROS CONCRETOS, custos jurídicos, riscos, vantagens/desvantagens, aderência aos objetivos.");
  lines.push("- Português europeu, tom profissional de parecer interno de grande escritório.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## DADOS DO CASO RECOLHIDOS NO INTAKE ESTRUTURADO");
  lines.push("");

  blocks.forEach(block => {
    const filled = block.questions.filter(q => {
      const v = data[q.id];
      return v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");
    });
    if (filled.length === 0) return;
    lines.push(`### Bloco ${block.id} — ${block.title}`);
    lines.push("");
    filled.forEach(q => {
      const v = data[q.id];
      const valStr = Array.isArray(v) ? v.join(", ") : String(v);
      lines.push(`- **${q.label}:** ${valStr}`);
    });
    lines.push("");
  });

  if (crossings.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## CRUZAMENTOS JURÍDICOS DETETADOS AUTOMATICAMENTE PELO INTAKE");
    lines.push("");
    lines.push("O sistema de intake identificou os seguintes pontos críticos a desenvolver no relatório:");
    lines.push("");
    crossings.forEach((c, i) => {
      lines.push(`### ${i + 1}. ${c.title}`);
      lines.push(`*Referência:* ${c.ref}`);
      lines.push("");
      lines.push(c.text);
      lines.push("");
    });
  }

  lines.push("---");
  lines.push("");
  lines.push("## PEDIDO FINAL");
  lines.push("");
  lines.push("Com base nos dados acima e nos cruzamentos identificados, gera um **RELATÓRIO COMPLETO DE REORGANIZAÇÃO SOCIETÁRIA E M&A** com a seguinte estrutura obrigatória:");
  lines.push("");
  lines.push("1. **Sumário Executivo (1 página)** — fotografia atual em 5-7 bullets, objetivo da operação, 2-3 riscos-chave, recomendação preliminar.");
  lines.push("2. **Contextualização** — quem é o cliente, situação atual, trigger da operação.");
  lines.push("3. **Composição Societária Atual** — subsecção por cada sociedade com NIPC, capital, sócios, gerência, atividade.");
  lines.push("4. **Principais Aspetos a Considerar** — pontos críticos jurídicos, fiscais e laborais.");
  lines.push("5. **Objetivos da Reorganização/Operação** — alinhados com a vontade do cliente.");
  lines.push("6. **Estrutura Societária Futura/Pretendida** — como deve ficar o grupo após a operação.");
  lines.push("7. **CENÁRIOS DE ESTRUTURAÇÃO (no mínimo 5)** — para cada cenário:");
  lines.push("   - **7.x.1** Descrição prática (quem vende o quê a quem, em que ordem)");
  lines.push("   - **7.x.2** Passos cronológicos detalhados (mês a mês)");
  lines.push("   - **7.x.3** Timing realista (mínimo, médio, máximo)");
  lines.push("   - **7.x.4** **Custo fiscal total CALCULADO COM NÚMEROS CONCRETOS** (IRC, IS, IMT, IVA, IRS) — mostra as contas");
  lines.push("   - **7.x.5** Custos jurídicos e administrativos (notariais, registais, IRN)");
  lines.push("   - **7.x.6** Riscos jurídicos, fiscais e operacionais");
  lines.push("   - **7.x.7** Vantagens e desvantagens para cada parte");
  lines.push("   - **7.x.8** Aderência aos objetivos do cliente (escala 1-5)");
  lines.push("   - **7.x.9** Aceitabilidade fiscal (verde/amarelo/vermelho)");
  lines.push("   - **7.x.10** ⚠ A VALIDAR COM FISCALISTA");
  lines.push("8. **Tabela Comparativa de Cenários** — todos os cenários lado a lado nas dimensões: custo fiscal, custo jurídico, timing, complexidade, risco, reversibilidade, aderência.");
  lines.push("9. **Conclusão Estratégica** — qual cenário tende a alinhar-se melhor (sem impor) e porquê.");
  lines.push("10. **Implicações Laborais** (se aplicável) — análise dos arts. 285.º e 286.º CT, prazos, formalismos.");
  lines.push("11. **Próximos Passos** — checklist do que fazer a seguir (DD, comunicações, deliberações, contratos).");
  lines.push("12. **Lista de Questões para o Fiscalista** — todas as matérias fiscais que precisam de validação numérica.");
  lines.push("13. **Informação em Falta / Assunções** — pontos que precisam de ser clarificados antes do closing.");
  lines.push("");
  lines.push("Sê EXAUSTIVO. Não simplifiques. Quero TODAS as alternativas viáveis com TODOS os cálculos.");
  lines.push("");
  lines.push("Se atingires o limite de uma resposta, para no fim de uma secção e indica onde paraste para eu pedir 'continua'.");
  return lines.join("\n");
}

// ── COMPONENTE: WIZARD M&A ────────────────────────────────────────────

function NovaOperacaoMA({ initialData, onCancel, onSaved }) {
  const [data, setData] = useState(initialData || {});
  const [activeBlock, setActiveBlock] = useState("A");
  const [phase, setPhase] = useState(1); // 1 = wizard, 2 = pacote
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [relatorio, setRelatorio] = useState(initialData?.relatorio || "");

  const upd = useCallback((id, v) => setData(d => ({ ...d, [id]: v })), []);

  const blocks = useMemo(() => getBlocks(data), [data]);
  const crossings = useMemo(() => detectCrossings(data), [data]);

  // Progresso por bloco
  const blockProgress = useMemo(() => {
    const r = {};
    blocks.forEach(b => {
      const total = b.questions.length;
      const filled = b.questions.filter(q => {
        const v = data[q.id];
        return v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");
      }).length;
      r[b.id] = { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
    });
    return r;
  }, [blocks, data]);

  const globalProgress = useMemo(() => {
    const totalQ = blocks.reduce((n, b) => n + b.questions.length, 0);
    const filledQ = blocks.reduce((n, b) => n + b.questions.filter(q => {
      const v = data[q.id];
      return v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");
    }).length, 0);
    return totalQ > 0 ? Math.round((filledQ / totalQ) * 100) : 0;
  }, [blocks, data]);

  // Sugestões de cenários
  const sugestoes = useMemo(() => {
    const s = [];
    if (data.op_tipo_op === "holding" && data.ativos_imoveis === "sim") {
      s.push("Caso candidato a estrutura com holding mista + sociedade imobiliária separada (proteção patrimonial + participation exemption).");
    }
    if (data.op_lado === "vendedor" && data.ativos_imoveis === "sim" && Number(data.soc_num) >= 2) {
      s.push("Caso candidato a cisão prévia para isolar o imóvel relevante antes da venda — pode reduzir significativamente o custo fiscal.");
    }
    if (data.fam_transmissao_gratuita === "sim" && data.fam_parentesco === "descendente") {
      s.push("Caso candidato a doação prévia de quotas em vida com isenção total de IS (art. 6.º CIS) antes da venda final.");
    }
    if (data.op_lado === "vendedor" && data.fin_dividas === "sim") {
      s.push("Caso candidato a venda em estrutura debt-free/cash-free com retenção em escrow para garantia de passivos.");
    }
    if (data.op_lado === "vendedor" && Number(data.op_valor) > 1000000) {
      s.push("Caso candidato a vendor loan (venda em fases) para diferir parte do recebimento e do imposto.");
    }
    if (data.op_tipo_op === "cisao" && data.ativos_imoveis === "sim") {
      s.push("ATENÇÃO: cisão imobiliária pode ser questionada pela AT como antiabuso se os imóveis não constituírem 'ramo de atividade'. Avaliar se há atividade económica real.");
    }
    return s;
  }, [data]);

  const promptCompleto = useMemo(() => generateClaudePrompt(data, blocks, crossings), [data, blocks, crossings]);
  const promptWordCount = useMemo(() => promptCompleto.split(/\s+/).length, [promptCompleto]);

  const guardar = () => {
    if (!data.op_titulo) { alert("Indique pelo menos o título da operação."); return; }
    const op = {
      id: initialData?.id || "op_" + Date.now(),
      titulo: data.op_titulo,
      data_criacao: initialData?.data_criacao || new Date().toISOString(),
      data_modificacao: new Date().toISOString(),
      status: relatorio ? "Relatório recolhido" : "Em intake",
      form: data,
      relatorio,
      crossings_detected: crossings.length,
    };
    saveOperacao(op);
    if (onSaved) onSaved(op);
  };

  // ── RENDER FASE 1: Wizard ──
  if (phase === 1) return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Nova Operação M&A</h1>
        <p style={{ fontSize: 13, color: CL.gr, margin: "4px 0 0" }}>Fase 1 — Intake estruturado. Preencha os blocos e gere o pacote para o Claude.ai.</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" size="sm" onClick={guardar}>💾 Guardar rascunho</Btn>
        <Btn v="ghost" onClick={onCancel}>✕</Btn>
      </div>
    </div>

    <div style={{ display: "flex", gap: 24 }}>
      {/* SIDEBAR ESQUERDA: navegação por blocos + progresso */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <Cd style={{ padding: 16, position: "sticky", top: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: CL.d, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Blocos</div>
          <ProgressBar value={globalProgress} label="Global" />
          <div style={{ marginTop: 12 }}>
            {blocks.map(b => {
              const bp = blockProgress[b.id] || { filled: 0, total: 0, pct: 0 };
              const isActive = activeBlock === b.id;
              return <div key={b.id} onClick={() => setActiveBlock(b.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 3, background: isActive ? "#F0F4FF" : "transparent", border: isActive ? `1px solid ${CL.g}` : "1px solid transparent" }}>
                <span style={{ fontSize: 14 }}>{b.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: CL.d, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.id}. {b.title}</div>
                  <div style={{ fontSize: 9, color: bp.pct >= 100 ? CL.gn : CL.gr }}>{bp.filled}/{bp.total}</div>
                </div>
                {bp.pct >= 100 && <span style={{ color: CL.gn, fontSize: 12 }}>✓</span>}
              </div>;
            })}
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
            <Btn v="accent" size="sm" style={{ width: "100%" }} onClick={() => setPhase(2)}>
              Gerar Pacote →
            </Btn>
            <p style={{ fontSize: 9, color: CL.gr, marginTop: 6, textAlign: "center", lineHeight: 1.4 }}>
              Pode gerar o pacote a qualquer momento. Campos vazios serão sinalizados como "Informação em falta".
            </p>
          </div>
        </Cd>
      </div>

      {/* CENTRO: bloco ativo */}
      <div style={{ flex: 1 }}>
        {blocks.filter(b => b.id === activeBlock).map(block => <Cd key={block.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 24 }}>{block.icon}</span>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Bloco {block.id} — {block.title}</h2>
              <p style={{ fontSize: 12, color: CL.gr, margin: "4px 0 0" }}>{(blockProgress[block.id] || {}).filled} de {(blockProgress[block.id] || {}).total} campos preenchidos</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {block.questions.map(q => <div key={q.id}>
              {q.type === "text" && <Inp label={q.label} value={data[q.id] || ""} onChange={v => upd(q.id, v)} placeholder={q.placeholder} hint={q.hint} />}
              {q.type === "number" && <Inp label={q.label} value={data[q.id] || ""} onChange={v => upd(q.id, v)} type="number" placeholder={q.placeholder} hint={q.hint} />}
              {q.type === "textarea" && <Inp label={q.label} value={data[q.id] || ""} onChange={v => upd(q.id, v)} placeholder={q.placeholder} multiline rows={q.rows || 3} hint={q.hint} />}
              {q.type === "select" && <Sel label={q.label} value={data[q.id] || ""} onChange={v => upd(q.id, v)} options={q.options} placeholder="Selecionar..." hint={q.hint} />}
              {q.type === "radio" && <Rad label={q.label} value={data[q.id] || ""} onChange={v => upd(q.id, v)} options={q.options} hint={q.hint} />}
              {q.type === "checkboxes" && <Chk label={q.label} values={data[q.id] || []} onChange={v => upd(q.id, v)} options={q.options} hint={q.hint} />}
            </div>)}
          </div>

          {/* Navegação entre blocos */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 20, borderTop: "1px solid #F1F5F9" }}>
            {(() => {
              const idx = blocks.findIndex(b => b.id === activeBlock);
              return <>
                {idx > 0 ? <Btn v="secondary" onClick={() => setActiveBlock(blocks[idx - 1].id)}>← Bloco anterior</Btn> : <div />}
                {idx < blocks.length - 1 ? <Btn onClick={() => setActiveBlock(blocks[idx + 1].id)}>Bloco seguinte →</Btn> : <Btn v="accent" onClick={() => setPhase(2)}>Gerar Pacote →</Btn>}
              </>;
            })()}
          </div>
        </Cd>)}
      </div>

      {/* SIDEBAR DIREITA: cruzamentos + sugestões */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <Cd style={{ padding: 16, marginBottom: 16, position: "sticky", top: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: CL.d, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ⇄ Cruzamentos detetados ({crossings.length})
          </div>
          {crossings.length === 0 && <div style={{ fontSize: 12, color: CL.gr, fontStyle: "italic" }}>Os cruzamentos jurídicos vão aparecer aqui à medida que preenche o questionário.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "40vh", overflowY: "auto" }}>
            {crossings.map(c => {
              const colors = { fiscal: { bg: "#FFF7ED", c: "#9A3412", b: "#EA580C" }, legal: { bg: "#FDF8F0", c: "#78582A", b: CL.g }, warning: { bg: "#FFFBEB", c: "#92400E", b: "#F59E0B" }, block: { bg: "#FEE2E2", c: "#991B1B", b: "#EF4444" }, suggestion: { bg: "#F0F9FF", c: "#0C4A6E", b: "#0EA5E9" } }[c.type] || { bg: "#F3F4F6", c: "#374151", b: "#9CA3AF" };
              return <div key={c.id} style={{ background: colors.bg, borderLeft: `3px solid ${colors.b}`, borderRadius: 4, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.c, marginBottom: 4, lineHeight: 1.3 }}>{c.title}</div>
                <div style={{ fontSize: 10, color: colors.c, opacity: 0.7, marginBottom: 4, fontStyle: "italic" }}>{c.ref}</div>
                <div style={{ fontSize: 11, color: colors.c, lineHeight: 1.4 }}>{c.text}</div>
              </div>;
            })}
          </div>
        </Cd>

        {sugestoes.length > 0 && <Cd style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: CL.d, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            💡 Sugestões de cenários
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sugestoes.map((s, i) => <div key={i} style={{ background: "#F0F9FF", borderLeft: "3px solid #0EA5E9", borderRadius: 4, padding: "8px 10px", fontSize: 11, color: "#0C4A6E", lineHeight: 1.4 }}>{s}</div>)}
          </div>
        </Cd>}
      </div>
    </div>
  </div>;

  // ── RENDER FASE 2: Pacote para Claude ──
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Pacote para Claude.ai</h1>
        <p style={{ fontSize: 13, color: CL.gr, margin: "4px 0 0" }}>Fase 2 — Copie o prompt abaixo e cole no Claude.ai (Opus 4.6 recomendado).</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="secondary" onClick={() => setPhase(1)}>← Voltar ao questionário</Btn>
        <Btn v="ghost" onClick={onCancel}>✕</Btn>
      </div>
    </div>

    {/* Diagnóstico */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      <Cd style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: CL.gr, textTransform: "uppercase", marginBottom: 4 }}>Preenchimento</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: globalProgress >= 70 ? CL.gn : CL.g, fontFamily: "'Playfair Display',serif" }}>{globalProgress}%</div>
      </Cd>
      <Cd style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: CL.gr, textTransform: "uppercase", marginBottom: 4 }}>Cruzamentos detetados</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{crossings.length}</div>
      </Cd>
      <Cd style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: CL.gr, textTransform: "uppercase", marginBottom: 4 }}>Palavras no prompt</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{promptWordCount.toLocaleString()}</div>
      </Cd>
    </div>

    {globalProgress < 30 && <div style={{ marginBottom: 16 }}><Al type="warning" title="Preenchimento baixo">O questionário tem menos de 30% de preenchimento. O Claude vai sinalizar muita "Informação em falta" no relatório. Considere voltar e completar mais campos.</Al></div>}

    {/* Prompt copiável */}
    <Cd style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: CL.d, margin: 0 }}>📋 Prompt completo para Claude.ai</h3>
          <p style={{ fontSize: 11, color: CL.gr, margin: "4px 0 0" }}>Copie tudo e cole no Claude.ai. Recomenda-se usar Opus 4.6.</p>
        </div>
        <Btn v="accent" onClick={() => { navigator.clipboard.writeText(promptCompleto); alert("Prompt copiado para a área de transferência!"); }}>📋 Copiar Tudo</Btn>
      </div>
      <textarea readOnly value={promptCompleto} style={{ width: "100%", minHeight: 400, padding: 16, border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, fontFamily: "monospace", lineHeight: 1.5, color: "#374151", background: "#F9FAFB", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
    </Cd>

    {/* Instruções */}
    <Cd style={{ marginBottom: 16, background: "#F0F9FF" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E", marginBottom: 8 }}>📖 Como usar este pacote</div>
      <ol style={{ fontSize: 12, color: "#0C4A6E", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
        <li>Clique em <strong>Copiar Tudo</strong> acima.</li>
        <li>Abra o <strong>Claude.ai</strong> numa nova aba (recomenda-se Opus 4.6).</li>
        <li>Anexe o seu <strong>manual jurídico</strong> (PDF) à conversa.</li>
        <li>Cole o prompt e envie. O Claude vai gerar o relatório completo (pode ser preciso pedir "continua" várias vezes).</li>
        <li>Quando terminar, copie o relatório e cole na caixa abaixo para o guardar nesta operação.</li>
      </ol>
    </Cd>

    {/* Recolha do relatório */}
    <Cd>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: CL.d, margin: 0 }}>📥 Relatório recolhido do Claude.ai</h3>
        <Btn v="ghost" size="sm" onClick={() => setShowRelatorio(!showRelatorio)}>{showRelatorio ? "Esconder" : (relatorio ? "Editar" : "Colar relatório")}</Btn>
      </div>
      {!showRelatorio && !relatorio && <p style={{ fontSize: 12, color: CL.gr, fontStyle: "italic" }}>Quando tiver o relatório do Claude.ai, clique em "Colar relatório" e cole-o aqui para guardar.</p>}
      {!showRelatorio && relatorio && <div style={{ fontSize: 12, color: CL.gn }}>✓ Relatório guardado ({relatorio.split(/\s+/).length.toLocaleString()} palavras)</div>}
      {showRelatorio && <textarea value={relatorio} onChange={e => setRelatorio(e.target.value)} placeholder="Cole aqui o relatório que o Claude.ai gerou..." style={{ width: "100%", minHeight: 300, padding: 12, border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />}
    </Cd>

    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
      <Btn v="secondary" onClick={() => setPhase(1)}>← Voltar ao questionário</Btn>
      <Btn v="accent" onClick={() => { guardar(); onCancel(); }}>💾 Guardar e Concluir</Btn>
    </div>
  </div>;
}

// ── COMPONENTE: LISTA DE OPERAÇÕES ────────────────────────────────────

function OperacoesView({ onNew, onOpen, onTemplate }) {
  const [ops, setOps] = useState([]);
  useEffect(() => { setOps(loadOperacoes()); }, []);

  const remover = (id) => {
    if (confirm("Eliminar esta operação?")) {
      deleteOperacao(id);
      setOps(loadOperacoes());
    }
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Operações M&A</h1>
        <p style={{ fontSize: 14, color: CL.gr, margin: "6px 0 0" }}>Reorganização societária, reestruturação, M&A — intake estruturado</p>
      </div>
      <Btn v="accent" size="lg" onClick={onNew}>+ Nova Operação</Btn>
    </div>

    <Al type="legal" title="Como funciona o módulo M&A">
      Este módulo NÃO chama qualquer API. Funciona como ferramenta de intake estruturado: preenche um questionário dinâmico com cruzamentos jurídicos automáticos, gera um pacote completo (prompt) que cola no Claude.ai (Opus 4.6) com o seu manual jurídico anexado, recebe o relatório e cola-o de volta no site para arquivo.
    </Al>

    {/* Templates rápidos */}
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>📦 Templates rápidos</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {OP_TEMPLATES.map(t => <Cd key={t.id} hover onClick={() => onTemplate(t)} style={{ padding: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: CL.d, marginBottom: 4 }}>{t.label}</div>
          <div style={{ fontSize: 11, color: CL.gr, lineHeight: 1.4 }}>{t.description}</div>
        </Cd>)}
      </div>
    </div>

    {/* Histórico */}
    {ops.length > 0 && <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: CL.gr, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>📂 Operações guardadas ({ops.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ops.slice().reverse().map(op => <Cd key={op.id} style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div onClick={() => onOpen(op)} style={{ cursor: "pointer", flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: CL.d }}>{op.titulo || "Sem título"}</div>
              <div style={{ fontSize: 11, color: CL.gr, marginTop: 4 }}>
                Modificado: {op.data_modificacao ? fmtD(op.data_modificacao) : fmtD(op.data_criacao)}
                {op.crossings_detected !== undefined && ` · ${op.crossings_detected} cruzamento(s) detetado(s)`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge t={op.status || "Em intake"} type={op.relatorio ? "success" : "info"} />
              <Btn v="ghost" size="sm" onClick={() => remover(op.id)}>🗑</Btn>
            </div>
          </div>
        </Cd>)}
      </div>
    </div>}
  </div>;
}

// ── APP ───────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");
  const [opData, setOpData] = useState(null); // dados a passar ao wizard

  const novaOp = () => { setOpData(null); setView("op_nova"); };
  const abrirOp = (op) => { setOpData({ ...op.form, id: op.id, relatorio: op.relatorio, data_criacao: op.data_criacao }); setView("op_nova"); };
  const usarTemplate = (t) => { setOpData(t.data); setView("op_nova"); };

  return <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F1F3F5;color:#1F2937;-webkit-font-smoothing:antialiased}::selection{background:#B8976A33}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#B8976A!important;box-shadow:0 0 0 3px #B8976A18}`}</style>
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={view === "op_nova" ? "operacoes" : view} setActive={v => { setView(v); setOpData(null); }} />
      <main style={{ flex: 1, padding: "32px 40px", maxHeight: "100vh", overflow: "auto" }}>
        {view === "wizard" ? <Wizard onCancel={() => setView("dashboard")} onDone={() => setView("dashboard")} /> :
          view === "sociedades" ? <SociedadesView /> :
          view === "operacoes" ? <OperacoesView onNew={novaOp} onOpen={abrirOp} onTemplate={usarTemplate} /> :
          view === "op_nova" ? <NovaOperacaoMA initialData={opData} onCancel={() => setView("operacoes")} onSaved={() => { }} /> :
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, color: CL.d, margin: 0, fontFamily: "'Playfair Display',serif" }}>Dashboard</h1>
                  <p style={{ fontSize: 14, color: CL.gr, margin: "6px 0 0" }}>Ferramentas internas P&A Legal</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <Cd hover onClick={() => setView("wizard")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Deliberações</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: CL.d }}>Atas, pactos sociais, listas de sócios</div>
                  <div style={{ fontSize: 13, color: CL.gr, marginTop: 4 }}>Geração automatizada de documentação societária</div>
                </Cd>
                <Cd hover onClick={() => setView("operacoes")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Operações M&A</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: CL.d }}>Reorganização societária e M&A</div>
                  <div style={{ fontSize: 13, color: CL.gr, marginTop: 4 }}>Wizard dinâmico → pacote para Claude.ai</div>
                </Cd>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <Cd>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Sociedades registadas</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{loadSociedades().length}</div>
                </Cd>
                <Cd>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CL.gr, textTransform: "uppercase", marginBottom: 8 }}>Operações M&A</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: CL.d, fontFamily: "'Playfair Display',serif" }}>{loadOperacoes().length}</div>
                </Cd>
              </div>
              <Al type="privacy" title="Arquitectura de segurança">Zero dados pessoais no servidor. Sócios anónimos. Tudo guardado localmente no browser. O módulo M&A não chama qualquer API — gera prompts para usar no Claude.ai.</Al>
            </div>}
      </main>
    </div>
  </>;
}
