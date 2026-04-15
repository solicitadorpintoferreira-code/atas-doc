import { supabase } from './supabase.js';

// ── SOCIEDADES ──────────────────────────────────────────────────────────
export async function listSociedades() {
  const { data, error } = await supabase.from('sociedades').select('*, socios(*)').order('firma');
  if (error) throw error;
  return data || [];
}

export async function getSociedadeByNipc(nipc) {
  const clean = nipc.replace(/[\s.]/g, '');
  const { data } = await supabase.from('sociedades').select('*, socios(*)').eq('nipc', clean).maybeSingle();
  return data;
}

export async function createSociedade(soc, profId) {
  const { socios, _new, id: _, created_at, updated_at, ...rest } = soc;
  const cleanNipc = (rest.nipc || '').replace(/[\s.]/g, '');
  const { data, error } = await supabase.from('sociedades').insert({ ...rest, nipc: cleanNipc, created_by: profId }).select().single();
  if (error) throw error;
  if (socios?.length) {
    await supabase.from('socios').insert(socios.map(s => ({
      sociedade_id: data.id, letra: s.letra || s.id, quota: s.quota || 0, pct: s.pct || 0,
      penhor: !!s.penhor, usufruto: !!s.usufruto, tipo_pessoa: s.tipo_pessoa || s.tipo || 'singular',
      nome: s.nome || null, nif: s.nif || null, doc_tipo: s.doc_tipo || 'CC', doc_num: s.doc_num || null,
      doc_validade: s.doc_validade || null, nacionalidade: s.nacionalidade || 'Portuguesa',
      estado_civil: s.estado_civil || null, regime_bens: s.regime_bens || null,
      natural_freguesia: s.natural_freguesia || null, natural_concelho: s.natural_concelho || null,
      morada: s.morada || null, email: s.email || null,
      conjuge_nome: s.conjuge_nome || null, conjuge_nif: s.conjuge_nif || null,
      conjuge_doc_num: s.conjuge_doc_num || null, conjuge_doc_validade: s.conjuge_doc_validade || null,
      is_gerente: !!s.is_gerente,
    })));
  }
  return await getSociedadeByNipc(cleanNipc);
}

export async function updateSociedade(id, soc) {
  const { socios, id: _, created_at, updated_at, ...rest } = soc;
  await supabase.from('sociedades').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
  if (socios) {
    await supabase.from('socios').delete().eq('sociedade_id', id);
    if (socios.length) await supabase.from('socios').insert(socios.map(s => ({
      sociedade_id: id, letra: s.letra || s.id, quota: s.quota || 0, pct: s.pct || 0,
      penhor: !!s.penhor, usufruto: !!s.usufruto, tipo_pessoa: s.tipo_pessoa || s.tipo || 'singular',
      nome: s.nome || null, nif: s.nif || null, doc_tipo: s.doc_tipo || 'CC', doc_num: s.doc_num || null,
      doc_validade: s.doc_validade || null, nacionalidade: s.nacionalidade || 'Portuguesa',
      estado_civil: s.estado_civil || null, regime_bens: s.regime_bens || null,
      natural_freguesia: s.natural_freguesia || null, natural_concelho: s.natural_concelho || null,
      morada: s.morada || null, email: s.email || null,
      conjuge_nome: s.conjuge_nome || null, conjuge_nif: s.conjuge_nif || null,
      conjuge_doc_num: s.conjuge_doc_num || null, conjuge_doc_validade: s.conjuge_doc_validade || null,
      is_gerente: !!s.is_gerente,
    })));
  }
  return await supabase.from('sociedades').select('*, socios(*)').eq('id', id).single().then(r => r.data);
}

export async function deleteSociedade(id) {
  await supabase.from('sociedades').delete().eq('id', id);
}

// ── PROCESSOS ───────────────────────────────────────────────────────────
export async function listProcessos(sociedadeId = null) {
  let q = supabase.from('processos').select('*, sociedades(firma, nipc)').order('data_processo', { ascending: false });
  if (sociedadeId) q = q.eq('sociedade_id', sociedadeId);
  const { data } = await q;
  return data || [];
}

export async function createProcesso(p) {
  const { data, error } = await supabase.from('processos').insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updateProcesso(id, updates) {
  const { data } = await supabase.from('processos').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return data;
}

// ── DOCUMENTOS EXIGIDOS POR CLIENTE ────────────────────────────────────
export async function listDocsExigidos(sociedadeId) {
  const { data } = await supabase.from('documentos_exigidos').select('*').eq('sociedade_id', sociedadeId).order('ordem');
  return data || [];
}

export async function saveDocsExigidos(sociedadeId, docs) {
  await supabase.from('documentos_exigidos').delete().eq('sociedade_id', sociedadeId);
  if (docs.length) {
    await supabase.from('documentos_exigidos').insert(docs.map((d, i) => ({
      sociedade_id: sociedadeId, nome: d.nome, descricao: d.descricao || null, obrigatorio: !!d.obrigatorio, ordem: i,
    })));
  }
}

// ── PROFISSIONAIS ───────────────────────────────────────────────────────
export async function listProfissionais() {
  const { data } = await supabase.from('profissionais').select('*').order('nome');
  return data || [];
}

export async function updateProfissional(id, updates) {
  const { data } = await supabase.from('profissionais').update(updates).eq('id', id).select().single();
  return data;
}

// ── OBRIGAÇÕES ──────────────────────────────────────────────────────────
export async function listObrigacoes() {
  const { data } = await supabase.from('obrigacoes_standard').select('*').eq('ativa', true);
  return data || [];
}

// Calcular próximas datas de obrigações para todas as sociedades
export function calcularProximasObrigacoes(sociedades, obrigacoes, dias = 90) {
  const hoje = new Date();
  const limite = new Date(); limite.setDate(limite.getDate() + dias);
  const eventos = [];
  for (const soc of sociedades) {
    for (const ob of obrigacoes) {
      const dt = new Date(hoje.getFullYear(), ob.mes - 1, ob.dia);
      if (dt < hoje) dt.setFullYear(dt.getFullYear() + 1);
      if (dt <= limite) eventos.push({ data: dt, sociedade: soc.firma, sociedadeId: soc.id, obrigacao: ob.nome, descricao: ob.descricao, cor: ob.cor });
    }
  }
  return eventos.sort((a, b) => a.data - b.data);
}
