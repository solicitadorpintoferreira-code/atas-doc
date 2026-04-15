-- ═══════════════════════════════════════════════════════════════════════
-- ATAS PRO v8 — Adições ao schema
-- Correr no SQL Editor do Supabase APÓS o schema original (schema.sql)
-- Após executar: Project Settings > General > Restart project
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Novos campos em socios (pessoas coletivas + quota liberada)
ALTER TABLE socios
  ADD COLUMN IF NOT EXISTS quota_liberada    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS firma_socio       TEXT,
  ADD COLUMN IF NOT EXISTS nipc_socio        TEXT,
  ADD COLUMN IF NOT EXISTS sede_socio        TEXT,
  ADD COLUMN IF NOT EXISTS representante_nome  TEXT,
  ADD COLUMN IF NOT EXISTS representante_cargo TEXT;

-- 2. Templates editáveis das deliberações (página Atlas)
CREATE TABLE IF NOT EXISTS atlas_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delib_id       TEXT NOT NULL UNIQUE,
  clausula_texto TEXT NOT NULL DEFAULT '',
  extra_campos   JSONB DEFAULT '[]',
  docs_adicionais TEXT[] DEFAULT '{}',
  updated_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE atlas_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all atlas_templates" ON atlas_templates FOR ALL TO authenticated USING (true);

-- 3. Artigos da Wikipédia jurídica
CREATE TABLE IF NOT EXISTS wikipedia_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  titulo                TEXT NOT NULL,
  categoria             TEXT NOT NULL DEFAULT 'deliberacoes',
  resumo                TEXT,
  quando_usar           TEXT,
  documentos_necessarios TEXT[],
  notas_legais          TEXT,
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE wikipedia_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all wikipedia_entries" ON wikipedia_entries FOR ALL TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- APÓS EXECUTAR: reiniciar o projeto Supabase
-- Project Settings > General > Restart project
-- ═══════════════════════════════════════════════════════════════════════
