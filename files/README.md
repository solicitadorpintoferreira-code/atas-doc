# ATAS PRO v7 — Documentação Societária + Operações M&A

Ferramenta interna de elaboração automatizada de atas societárias e estruturação de operações de reorganização societária e M&A em Portugal.

## Novidades v7

### Módulo Operações (reformulado)
- **Questionário estruturado em 8 blocos** (contexto, composição societária, atividade, ativos, família/partes relacionadas, situação financeira, trabalhadores, prazos/valores)
- **Estado de preenchimento** por bloco e global com barras de progresso
- **System prompt jurídico avançado** com especificação completa de reorganização societária e M&A
- **Cruzamentos obrigatórios**: doação de quotas ↔ imposto do selo, permuta ↔ neutralidade fiscal, cisão/fusão ↔ regime especial, transmissão de estabelecimento ↔ direito laboral
- **Relatório "50K"** com 11 secções obrigatórias + resumo executivo
- **Caixas "A validar com o fiscalista"** em todas as matérias fiscais
- **Exportação DOCX robusta** com parsing de markdown, caixas fiscais destacadas, formatação profissional
- Histórico de operações guardado em localStorage

### Módulo Deliberações (mantido)
- Geração automatizada de atas, pactos sociais, listas de sócios
- Validação jurídica com bloqueios e alertas (CSC, Lei 89/2017)
- Certificado de admissibilidade com exceções legais
- Exportação real em DOCX

### Correções
- **Fix da geração DOCX** — função `generateReportDocx` reescrita com parsing robusto de markdown, suporte a bold inline, caixas fiscais com bordas, e tratamento correto de todas as secções
- **Max tokens aumentado** para 16000 para relatórios mais completos

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

## Estrutura de ficheiros
```
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
└── src/
    ├── main.jsx
    └── App.jsx          ← todo o código da aplicação
```

## Referências Jurídicas
- CSC: Arts. 54.º, 87.º, 89.º, 91.º, 141.º, 210.º, 211.º, 213.º, 221.º, 228.º, 231.º, 232.º, 236.º, 265.º, 266.º
- Lei n.º 89/2017 (RCBE) — Art. 14.º
- CIRC: Arts. 68.º, 73.º, 77.º, 86.º, 86.º-A
- CIS: Arts. 1.º, 6.º — Verba 1.2 da Tabela Geral
- CT: Arts. 285.º, 286.º (transmissão de empresa/estabelecimento)
- RJRNPC: Art. 54.º, n.º 3 (dispensa certificado admissibilidade)
