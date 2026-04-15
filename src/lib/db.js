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

const mapSocio = (s, sociedadeId) => ({
  sociedade_id: sociedadeId || s.sociedade_id,
  letra: s.letra || 'A',
  quota: s.quota || 0,
  pct: s.pct || 0,
  penhor: !!s.penhor,
  usufruto: !!s.usufruto,
  tipo_pessoa: s.tipo_pessoa || 'singular',
  quota_liberada: !!s.quota_liberada,
  nome: s.nome || null,
  nif: s.nif || null,
  doc_tipo: s.doc_tipo || 'CC',
  doc_num: s.doc_num || null,
  doc_validade: s.doc_validade || null,
  nacionalidade: s.nacionalidade || 'Portuguesa',
  estado_civil: s.estado_civil || null,
  regime_bens: s.regime_bens || null,
  natural_freguesia: s.natural_freguesia || null,
  natural_concelho: s.natural_concelho || null,
  morada: s.morada || null,
  email: s.email || null,
  conjuge_nome: s.conjuge_nome || null,
  conjuge_nif: s.conjuge_nif || null,
  conjuge_doc_num: s.conjuge_doc_num || null,
  conjuge_doc_validade: s.conjuge_doc_validade || null,
  is_gerente: !!s.is_gerente,
  firma_socio: s.firma_socio || null,
  nipc_socio: s.nipc_socio || null,
  sede_socio: s.sede_socio || null,
  representante_nome: s.representante_nome || null,
  representante_cargo: s.representante_cargo || null,
});

export async function createSociedade(soc, profId) {
  const { socios, _new, id: _, created_at, updated_at, ...rest } = soc;
  const cleanNipc = (rest.nipc || '').replace(/[\s.]/g, '');
  const { data, error } = await supabase
    .from('sociedades')
    .insert({ ...rest, nipc: cleanNipc, created_by: profId })
    .select()
    .single();
  if (error) throw error;
  if (socios?.length) {
    await supabase.from('socios').insert(socios.map(s => mapSocio(s, data.id)));
  }
  return await getSociedadeByNipc(cleanNipc);
}

export async function updateSociedade(id, soc) {
  const { socios, id: _, created_at, updated_at, ...rest } = soc;
  await supabase.from('sociedades')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (socios) {
    await supabase.from('socios').delete().eq('sociedade_id', id);
    if (socios.length) await supabase.from('socios').insert(socios.map(s => mapSocio(s, id)));
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
  const { data } = await supabase.from('processos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  return data;
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

// Obrigações para TODAS as empresas em Portugal (independente das registadas no sistema)
export function calcularProximasObrigacoesPortugal(obrigacoes, dias = 90) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return obrigacoes.map(ob => {
    let dt = new Date(hoje.getFullYear(), ob.mes - 1, ob.dia);
    if (dt < hoje) dt.setFullYear(dt.getFullYear() + 1);
    return { data: dt, obrigacao: ob.nome, descricao: ob.descricao, cor: ob.cor, periodicidade: ob.periodicidade };
  }).filter(e => e.data <= limite).sort((a, b) => a.data - b.data);
}

// ── ATLAS ───────────────────────────────────────────────────────────────
export async function getAtlasTemplate(delibId) {
  const { data } = await supabase.from('atlas_templates').select('*').eq('delib_id', delibId).maybeSingle();
  return data || null;
}

export async function saveAtlasTemplate(delibId, fields) {
  const existing = await getAtlasTemplate(delibId);
  if (existing) {
    await supabase.from('atlas_templates')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('delib_id', delibId);
  } else {
    await supabase.from('atlas_templates').insert({ delib_id: delibId, ...fields });
  }
}

// ── WIKIPEDIA ───────────────────────────────────────────────────────────
export async function listWikipediaEntries() {
  const { data } = await supabase.from('wikipedia_entries').select('*').order('titulo');
  return data || [];
}

export async function getWikipediaEntry(slug) {
  const { data } = await supabase.from('wikipedia_entries').select('*').eq('slug', slug).maybeSingle();
  return data || null;
}

export async function saveWikipediaEntry(slug, entry) {
  const existing = await getWikipediaEntry(slug);
  if (existing) {
    await supabase.from('wikipedia_entries')
      .update({ ...entry, updated_at: new Date().toISOString() })
      .eq('slug', slug);
  } else {
    await supabase.from('wikipedia_entries').insert({ slug, ...entry });
  }
}
