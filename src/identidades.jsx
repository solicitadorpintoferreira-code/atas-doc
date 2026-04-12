import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════
// IDENTIDADES — Recolha de dados pessoais SÓ EM MEMÓRIA
// Nenhum dado persistido em localStorage ou servidor
// ═══════════════════════════════════════════════════════════════════════

// Estrutura de uma identidade de pessoa singular
export const emptyPessoaSingular = () => ({
  tipo: "singular",
  nome: "",
  nacionalidade: "Portuguesa",
  estadoCivil: "",
  regimeBens: "",
  conjugeNome: "",
  conjugeNif: "",
  conjugeDocTipo: "CC",
  conjugeDocNum: "",
  conjugeDocValidade: "",
  conjugeMorada: "",
  naturalFreguesia: "",
  naturalConcelho: "",
  nif: "",
  docTipo: "CC",
  docNum: "",
  docEmissor: "República Portuguesa",
  docValidade: "",
  morada: "",
  email: "",
});

export const emptyPessoaColetiva = () => ({
  tipo: "coletiva",
  firma: "",
  nipc: "",
  sede: "",
  capital: "",
  objeto: "",
  representantes: [{ nome: "", nif: "", cargo: "gerente" }],
});

const ESTADOS_CIVIS = [
  { v: "solteiro", l: "Solteiro(a)" },
  { v: "casado", l: "Casado(a)" },
  { v: "divorciado", l: "Divorciado(a)" },
  { v: "viuvo", l: "Viúvo(a)" },
  { v: "uniao_facto", l: "União de facto" },
];

const REGIMES_BENS = [
  { v: "comunhao_adquiridos", l: "Comunhão de adquiridos" },
  { v: "comunhao_geral", l: "Comunhão geral de bens" },
  { v: "separacao", l: "Separação de bens" },
];

const DOC_TIPOS = [
  { v: "CC", l: "Cartão de Cidadão" },
  { v: "TR", l: "Título de Residência" },
  { v: "AR", l: "Autorização de Residência" },
  { v: "PASSAPORTE", l: "Passaporte" },
];

// Gera a frase de identificação completa para documentos
export function formatarIdentificacao(id) {
  if (!id || !id.tipo) return "[IDENTIFICAÇÃO EM FALTA]";
  if (id.tipo === "coletiva") {
    return `${id.firma}, sociedade por quotas, com o número de pessoa coletiva ${id.nipc}, com sede em ${id.sede}, e com o capital social de ${id.capital}, neste ato representada pelo seu ${id.representantes[0]?.cargo || "gerente"} ${id.representantes[0]?.nome || "[REPRESENTANTE]"}`;
  }

  const doc = DOC_TIPOS.find(d => d.v === id.docTipo)?.l || "Documento de identificação";
  let base = `${id.nome}, ${id.nacionalidade?.toLowerCase() === "portuguesa" ? "de nacionalidade Portuguesa" : `de nacionalidade ${id.nacionalidade}`}`;

  if (id.estadoCivil === "casado") {
    const regime = REGIMES_BENS.find(r => r.v === id.regimeBens)?.l.toLowerCase() || "[regime]";
    base += `, casado(a) sob o regime da ${regime}`;
    if (id.conjugeNome) base += ` com ${id.conjugeNome}, NIF ${id.conjugeNif || "[NIF CÔNJUGE]"}`;
  } else if (id.estadoCivil) {
    base += `, ${ESTADOS_CIVIS.find(e => e.v === id.estadoCivil)?.l.toLowerCase() || id.estadoCivil}`;
  }

  if (id.naturalFreguesia) base += `, natural da freguesia de ${id.naturalFreguesia}${id.naturalConcelho ? `, concelho de ${id.naturalConcelho}` : ""}`;
  base += `, com o número de identificação fiscal ${id.nif}`;
  base += `, portador(a) do ${doc} n.º ${id.docNum}, emitido pel${id.docEmissor === "República Portuguesa" ? "a" : "o"} ${id.docEmissor}${id.docValidade ? ` e válido até ${id.docValidade}` : ""}`;
  if (id.morada) base += `, residente em ${id.morada}`;

  return base;
}

// Componente de recolha de identidade para um sócio
export function IdentidadeSocioForm({ socioId, socioPct, socioQuota, identidade, onUpdate }) {
  const id = identidade || emptyPessoaSingular();
  const upd = (k, v) => onUpdate({ ...id, [k]: v });
  const updConjuge = (k, v) => onUpdate({ ...id, [k]: v });

  const inp = (label, key, opts = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}{opts.req && <span style={{ color: "#B8976A" }}> *</span>}</label>
      <input type={opts.type || "text"} value={id[key] || ""} onChange={e => upd(key, e.target.value)} placeholder={opts.ph} style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
    </div>
  );

  const sel = (label, key, options, opts = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}{opts.req && <span style={{ color: "#B8976A" }}> *</span>}</label>
      <select value={id[key] || ""} onChange={e => upd(key, e.target.value)} style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" }}>
        <option value="">Selecionar...</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #F1F5F9" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Sócio {socioId}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{socioQuota} ({socioPct}%)</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["singular", "coletiva"].map(t => (
            <button key={t} onClick={() => onUpdate(t === "singular" ? emptyPessoaSingular() : emptyPessoaColetiva())} style={{ padding: "6px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, border: id.tipo === t ? "2px solid #0F172A" : "1px solid #D1D5DB", background: id.tipo === t ? "#F0F4FF" : "#fff", cursor: "pointer" }}>
              {t === "singular" ? "Pessoa Singular" : "Pessoa Coletiva"}
            </button>
          ))}
        </div>
      </div>

      {id.tipo === "singular" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>{inp("Nome completo", "nome", { req: true, ph: "Ex: João Silva Santos" })}</div>
          {inp("Nacionalidade", "nacionalidade", { req: true })}
          {sel("Estado Civil", "estadoCivil", ESTADOS_CIVIS, { req: true })}
          {id.estadoCivil === "casado" && sel("Regime de Bens", "regimeBens", REGIMES_BENS, { req: true })}
          {inp("Natural (freguesia)", "naturalFreguesia")}
          {inp("Natural (concelho)", "naturalConcelho")}
          {inp("NIF", "nif", { req: true })}
          {sel("Tipo Documento", "docTipo", DOC_TIPOS, { req: true })}
          {inp("N.º Documento", "docNum", { req: true })}
          {inp("Validade", "docValidade", { ph: "DD/MM/AAAA" })}
          <div style={{ gridColumn: "1/-1" }}>{inp("Morada", "morada", { req: true })}</div>
          {inp("Email", "email", { type: "email" })}

          {id.estadoCivil === "casado" && (
            <div style={{ gridColumn: "1/-1", marginTop: 8, padding: 16, background: "#FDF8F0", borderRadius: 8, border: "1px solid #E9D8AB" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#78582A", marginBottom: 12 }}>Cônjuge (obrigatório para declarações relevantes)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1/-1" }}>{inp("Nome do cônjuge", "conjugeNome", { req: true })}</div>
                {inp("NIF cônjuge", "conjugeNif")}
                {sel("Doc. cônjuge", "conjugeDocTipo", DOC_TIPOS)}
                {inp("N.º Doc. cônjuge", "conjugeDocNum")}
                {inp("Validade", "conjugeDocValidade", { ph: "DD/MM/AAAA" })}
                <div style={{ gridColumn: "span 2" }}>{inp("Morada cônjuge (se diferente)", "conjugeMorada")}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>{inp("Firma", "firma", { req: true, ph: "Ex: Empresa Exemplo, Lda." })}</div>
          {inp("NIPC", "nipc", { req: true })}
          {inp("Capital Social", "capital", { ph: "Ex: €100.000,00" })}
          <div style={{ gridColumn: "1/-1" }}>{inp("Sede", "sede", { req: true })}</div>
          <div style={{ gridColumn: "1/-1" }}>{inp("Objeto Social", "objeto")}</div>
          <div style={{ gridColumn: "1/-1", marginTop: 8, padding: 12, background: "#F8FAFC", borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Representante Legal (gerente)</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <input placeholder="Nome do gerente" value={id.representantes?.[0]?.nome || ""} onChange={e => upd("representantes", [{ ...(id.representantes?.[0] || {}), nome: e.target.value, cargo: "gerente" }])} style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }} />
              </div>
              <div>
                <input placeholder="NIF" value={id.representantes?.[0]?.nif || ""} onChange={e => upd("representantes", [{ ...(id.representantes?.[0] || {}), nif: e.target.value, cargo: "gerente" }])} style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Passo de recolha — todas as identidades dos sócios
export function PassoIdentificacao({ soc, identidades, onUpdateIdentidade }) {
  return (
    <div>
      <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderLeft: "3px solid #F59E0B", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 4 }}>⚠ Dados apenas em memória</div>
        <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>Os dados pessoais preenchidos aqui <strong>não são guardados em servidor nem localmente</strong>. Servem apenas para gerar os documentos desta sessão. Quando fechar o browser, desaparecem.</div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", margin: "0 0 8px" }}>Identificação das Partes</h3>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>Preencha os dados reais de cada sócio. Os documentos serão gerados com estes dados integrados (sem placeholders).</p>

        {soc?.socios?.map(s => (
          <IdentidadeSocioForm
            key={s.id}
            socioId={s.id}
            socioPct={s.pct}
            socioQuota={new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(s.quota)}
            identidade={identidades[s.id]}
            onUpdate={novo => onUpdateIdentidade(s.id, novo)}
          />
        ))}
      </div>
    </div>
  );
}
