# ATAS PRO v6 — Documentação Societária + Operações

Ferramenta interna de elaboração automatizada de atas societárias e estruturação de operações de venda de restaurantes com componente imobiliária.

## Novidades v6

### Módulo Operações (novo)
- Formulário de intake estruturado para operações de venda de restaurantes com imóveis
- Análise jurídica automatizada via Claude API (claude-sonnet-4) com system prompt especializado
- Relatório completo com 9 secções obrigatórias: factos, lacunas, perímetro, riscos, cenários (asset deal, share deal, híbrido), passos prévios, questões fiscais, cronograma, resumo executivo
- Exportação do relatório em DOCX
- Histórico de operações guardado em localStorage

### Módulo Deliberações (existente)
- Geração automatizada de atas, pactos sociais, listas de sócios
- Validação jurídica com bloqueios e alertas (CSC, Lei 89/2017)
- Certificado de admissibilidade com exceções legais
- Exportação real em DOCX

## Arquitetura de Segurança
- **Zero dados pessoais no servidor** — sócios anónimos, placeholders nos documentos
- **Operações guardadas localmente** — localStorage, sem persistência remota
- **API calls diretas** — sem proxy, autenticação gerida pelo Claude.ai artifact runtime

## Deploy no Netlify

### Opção 1: Netlify Drop
```bash
npm install
npm run build
```
Arrastar a pasta `dist/` para o Netlify Drop (app.netlify.com/drop)

### Opção 2: Via GitHub
1. Push deste projeto para GitHub
2. Netlify: New Site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`

## Desenvolvimento local
```bash
npm install
npm run dev
```

## Stack
- React 18 + Vite 6
- docx + file-saver (geração DOCX)
- Claude API (claude-sonnet-4-20250514) para análise de operações
- Vanilla CSS (inline styles)

## Referências Jurídicas
- Arts. 54.º, 87.º, 89.º, 91.º, 210.º, 211.º, 213.º, 228.º, 231.º, 232.º, 236.º, 265.º CSC
- Arts. 31.º a 33.º CSC
- Art. 14.º da Lei n.º 89/2017 (RCBE)
- RJACSR (regime jurídico de restauração)
- Código do Trabalho (transmissão de empresa/estabelecimento)
