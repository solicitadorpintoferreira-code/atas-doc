-- ═══════════════════════════════════════════════════════════════════════
-- ATAS PRO v7 — Esquema Supabase
-- ═══════════════════════════════════════════════════════════════════════
-- Correr este SQL completo no SQL Editor do Supabase após criar o projeto.
-- ═══════════════════════════════════════════════════════════════════════

-- ── PROFISSIONAIS ──────────────────────────────────────────────────────
-- Ligado ao auth.users do Supabase Auth
CREATE TABLE profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cargo TEXT DEFAULT 'Solicitador',
  ativo BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── SOCIEDADES ─────────────────────────────────────────────────────────
CREATE TABLE sociedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nipc TEXT NOT NULL UNIQUE,
  firma TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Sociedade por Quotas',
  sede TEXT,
  capital NUMERIC(15,2),
  objeto TEXT,
  forma_obrigar TEXT,
  num_gerentes INTEGER DEFAULT 1,
  maioria_contratual NUMERIC(5,2),
  notas TEXT,
  created_by UUID REFERENCES profissionais(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── SÓCIOS (estrutura de quotas + dados pessoais persistidos) ──────────
CREATE TABLE socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedade_id UUID NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  letra TEXT NOT NULL,
  quota NUMERIC(15,2) NOT NULL DEFAULT 0,
  pct NUMERIC(7,4) NOT NULL DEFAULT 0,
  penhor BOOLEAN DEFAULT false,
  usufruto BOOLEAN DEFAULT false,
  tipo_pessoa TEXT DEFAULT 'singular',
  nome TEXT,
  nif TEXT,
  doc_tipo TEXT DEFAULT 'CC',
  doc_num TEXT,
  doc_validade TEXT,
  nacionalidade TEXT DEFAULT 'Portuguesa',
  estado_civil TEXT,
  regime_bens TEXT,
  natural_freguesia TEXT,
  natural_concelho TEXT,
  morada TEXT,
  email TEXT,
  conjuge_nome TEXT,
  conjuge_nif TEXT,
  conjuge_doc_num TEXT,
  conjuge_doc_validade TEXT,
  is_gerente BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sociedade_id, letra)
);

-- ── PROCESSOS / DELIBERAÇÕES (histórico) ───────────────────────────────
CREATE TABLE processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedade_id UUID NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipos_deliberacao TEXT[],
  estado TEXT DEFAULT 'rascunho',
  data_processo DATE DEFAULT CURRENT_DATE,
  dados_form JSONB,
  documentos_gerados TEXT[],
  profissional_id UUID REFERENCES profissionais(id),
  profissional_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── DOCUMENTOS EXIGIDOS POR CLIENTE ────────────────────────────────────
CREATE TABLE documentos_exigidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedade_id UUID NOT NULL REFERENCES sociedades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── OBRIGAÇÕES STANDARD (templates) ────────────────────────────────────
CREATE TABLE obrigacoes_standard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  mes INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  periodicidade TEXT DEFAULT 'anual',
  cor TEXT DEFAULT '#B8976A',
  ativa BOOLEAN DEFAULT true
);

-- Seed das obrigações standard portuguesas
INSERT INTO obrigacoes_standard (nome, descricao, mes, dia, periodicidade, cor) VALUES
('Modelo 22 (IRC)', 'Declaração anual de IRC', 5, 31, 'anual', '#DC2626'),
('IES — Informação Empresarial Simplificada', 'Depósito de contas', 7, 15, 'anual', '#D97706'),
('RCBE — Confirmação anual', 'Atualização do Registo Central do Beneficiário Efetivo', 7, 31, 'anual', '#7C3AED'),
('Ata anual de aprovação de contas', 'Aprovação das contas do exercício anterior', 3, 31, 'anual', '#2563EB'),
('IVA — 1.º trimestre', 'Declaração periódica IVA', 5, 20, 'trimestral', '#059669'),
('IVA — 2.º trimestre', 'Declaração periódica IVA', 8, 20, 'trimestral', '#059669'),
('IVA — 3.º trimestre', 'Declaração periódica IVA', 11, 20, 'trimestral', '#059669'),
('IVA — 4.º trimestre', 'Declaração periódica IVA', 2, 20, 'trimestral', '#059669');

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────────────
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE sociedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_exigidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrigacoes_standard ENABLE ROW LEVEL SECURITY;

-- Política: utilizadores autenticados veem tudo (escritório partilhado)
CREATE POLICY "auth read profissionais" ON profissionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write profissionais" ON profissionais FOR ALL TO authenticated USING (true);
CREATE POLICY "auth all sociedades" ON sociedades FOR ALL TO authenticated USING (true);
CREATE POLICY "auth all socios" ON socios FOR ALL TO authenticated USING (true);
CREATE POLICY "auth all processos" ON processos FOR ALL TO authenticated USING (true);
CREATE POLICY "auth all docs exigidos" ON documentos_exigidos FOR ALL TO authenticated USING (true);
CREATE POLICY "auth read obrigacoes" ON obrigacoes_standard FOR SELECT TO authenticated USING (true);

-- ── TRIGGER: criar profissional automaticamente ao registar ────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profissionais (user_id, nome, email, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    (SELECT COUNT(*) = 0 FROM public.profissionais)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── ÍNDICES ────────────────────────────────────────────────────────────
CREATE INDEX idx_socios_sociedade ON socios(sociedade_id);
CREATE INDEX idx_processos_sociedade ON processos(sociedade_id);
CREATE INDEX idx_processos_data ON processos(data_processo DESC);
CREATE INDEX idx_docs_exigidos_sociedade ON documentos_exigidos(sociedade_id);

-- ═══════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════
