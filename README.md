# ATAS PRO v4 — Documentação Societária

Ferramenta interna de elaboração automatizada de atas societárias, pactos sociais, listas de sócios e documentação complementar para sociedades por quotas.

## Arquitetura de Segurança

- **Zero dados pessoais no servidor** — nomes, NIFs, moradas, etc. nunca são persistidos
- **Sócios anónimos** — Sócio A, Sócio B, Gerente A
- **Placeholders nos documentos** — `[NOME_SOCIO_A]`, `[NIF_SOCIO_A]`, etc.
- **Preenchimento local** — dados pessoais são preenchidos em Word após exportação

## Deploy no Netlify

### Opção 1: Via GitHub
1. Criar repositório no GitHub
2. Fazer push deste projeto
3. No Netlify: New Site → Import from Git → selecionar o repositório
4. Build command: `npm run build`
5. Publish directory: `dist`

### Opção 2: Deploy manual
```bash
npm install
npm run build
```
Arrastar a pasta `dist/` para o Netlify Drop (app.netlify.com/drop)

## Desenvolvimento local
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`

## Stack
- React 18
- Vite 6
- Vanilla CSS (inline styles)
- Sem dependências externas além de React

## Referências Jurídicas
- Arts. 87.º, 89.º, 91.º, 210.º, 211.º, 213.º, 228.º, 231.º, 232.º, 236.º, 265.º CSC
- Arts. 31.º a 33.º CSC
- Art. 14.º da Lei n.º 89/2017 (RCBE)
