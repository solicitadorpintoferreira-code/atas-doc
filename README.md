# ATAS PRO v7 — P&A Legal

Aplicação interna de documentação societária — multi-utilizador com Supabase.

## Funcionalidades

- Login individual por profissional (Supabase Auth)
- Base de dados central de sociedades e sócios (partilhada entre profissionais)
- Histórico de processos com identificação do profissional
- Calendário de obrigações legais e fiscais (IES, Modelo 22, IVA, RCBE, atas anuais)
- Documentos exigidos personalizáveis por cliente
- Geração de DOCX (atas, listas, contratos, parassocial, declaração de bem próprio)
- Aba "Documentos avulsos" para gerar fora do wizard
- Gestão de profissionais nas configurações

---

## DEPLOY — Passo a passo completo

### Parte 1 — Criar o projeto Supabase (10 min)

1. Aceder a [supabase.com](https://supabase.com) e criar conta (grátis)
2. Clicar **New project**
3. Preencher:
   - Name: `atas-pro` (ou outro nome)
   - Database Password: escolher uma forte e **guardar bem**
   - Region: West EU (Ireland) — mais próximo de Portugal
4. Esperar 1-2 minutos pela criação

5. **Correr o SQL do esquema**:
   - No menu lateral: **SQL Editor**
   - Clicar **New query**
   - Abrir o ficheiro `supabase/schema.sql` deste projeto, copiar todo o conteúdo
   - Colar no editor e clicar **Run** (canto inferior direito)
   - Deve aparecer "Success. No rows returned"

6. **Obter as credenciais**:
   - No menu lateral: **Settings → API**
   - Copiar:
     - `Project URL` → ex: `https://abcd.supabase.co`
     - `anon public` (a chave longa) → começa por `eyJ...`

7. **Configurar Auth**:
   - **Authentication → Providers → Email** → garantir que está enabled
   - **Authentication → Settings**:
     - Desativar "Confirm email" (para criar contas sem ter de confirmar email) — ou deixar ativo se preferir confirmação
     - Site URL: deixar `http://localhost:5173` para já

### Parte 2 — Criar a primeira conta (Patrício)

1. **Authentication → Users → Add user → Create new user**
2. Email: `patricio.ferreira@pa-legal.pt`
3. Password: `123456`
4. **Auto Confirm User**: ✓ (marcar)
5. Criar

   > O trigger SQL cria automaticamente o registo em `profissionais` e marca o primeiro utilizador como **admin**.

6. (Opcional) Verificar em **Table Editor → profissionais** que aparece a linha com `is_admin = true`.

### Parte 3 — Testar localmente (5 min)

1. Descomprimir o zip
2. Terminal na pasta:
   ```
   cd atas-pro-v7
   npm install
   ```
3. Criar ficheiro `.env` na raiz com:
   ```
   VITE_SUPABASE_URL=https://abcd.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   (substituir pelas credenciais do passo 1.6)
4. ```
   npm run dev
   ```
5. Abrir [http://localhost:5173](http://localhost:5173)
6. Login: `patricio.ferreira@pa-legal.pt` / `123456`

### Parte 4 — Deploy no Netlify

#### Opção A — Drop simples
1. Build: `npm run build`
2. [app.netlify.com/drop](https://app.netlify.com/drop) → arrastar pasta `dist/`
3. **Site settings → Environment variables**: adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
4. **Deploys → Trigger deploy → Clear cache and deploy**

#### Opção B — GitHub (recomendado)
1. Criar repositório privado no GitHub
2. ```
   git init
   git add .
   git commit -m "ATAS PRO v7"
   git remote add origin [URL]
   git push -u origin main
   ```
3. Netlify → New site → Import from Git → escolher repositório
4. **Site settings → Environment variables**: adicionar as duas VITE_*
5. Netlify configura tudo automaticamente (build + deploy)

### Parte 5 — Atualizar Site URL no Supabase

Depois de ter o URL do Netlify (ex: `https://atas-pro.netlify.app`):
- Supabase → Authentication → URL Configuration → **Site URL**: `https://atas-pro.netlify.app`
- Adicionar também em **Redirect URLs**: `https://atas-pro.netlify.app`

---

## Adicionar mais profissionais

Como administrador, na app: **Configurações → Profissionais → Adicionar profissional**.

Ou diretamente no Supabase: **Authentication → Add user**.

## Stack
- React 18 + Vite 6
- Supabase (Postgres + Auth)
- docx + file-saver

## Suporte
Em caso de dúvida sobre deploy, verificar:
- Variáveis de ambiente preenchidas no Netlify
- Site URL no Supabase a apontar para o domínio Netlify
- Email/password do utilizador existem em Authentication → Users
