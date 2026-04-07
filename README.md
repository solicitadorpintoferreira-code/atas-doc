# ATAS PRO v8 — Documentação Societária + Operações M&A

Ferramenta interna P&A Legal. **Funciona 100% no browser**, sem servidor, sem APIs externas, sem chaves.

## O que mudou no v8

### Módulo Operações M&A — completamente novo
- **Wizard dinâmico em 9 blocos** (Contexto, Sociedades, Atividades, Ativos, Família, Financeiro, Trabalhadores, Intenções, Restrições)
- **Perguntas condicionais** que aparecem/desaparecem conforme as respostas
- **Predominância de formulários** (radios, selects, checkboxes) com uma textarea de "Observações" por bloco
- **14 cruzamentos jurídicos automáticos** detetados em tempo real (doação→IS com cálculo, permuta→neutralidade, cisão→regime especial, transmissão→art. 285.º CT, etc.)
- **Sugestões de cenários** baseadas em combinações de respostas
- **3 templates rápidos** (venda restaurante, holding familiar, doação a filhos)
- **Gerador de prompt completo** para colar no Claude.ai (Opus 4.6)
- **Recolha do relatório de volta** após geração no Claude.ai
- **Histórico** de operações com edição

### Módulo Deliberações — mantido do v6
- NIPC → wizard → DOCX (sem alterações)

## ⚠ IMPORTANTE — Como funciona o módulo M&A

Este módulo **NÃO chama qualquer API**. Não há Netlify Functions, não há servidores, não há chaves de API. Funciona como uma ferramenta de **intake estruturado**:

1. Preenche o questionário dinâmico no site
2. O site gera um **prompt completo** (com instruções, dados, cruzamentos detetados)
3. Você **copia o prompt** e cola no Claude.ai (recomenda-se Opus 4.6)
4. Anexa o seu **manual jurídico** (PDF) à conversa do Claude.ai
5. O Claude.ai gera o relatório (pode ser preciso pedir "continua" várias vezes)
6. Volta ao site e cola o relatório de volta para arquivar na operação

Esta abordagem resolve **todos** os problemas de versões anteriores: zero CORS, zero timeouts, zero infraestrutura, qualidade máxima do modelo (Opus em vez de Sonnet via API), custo zero.

## Deploy no Netlify

### Opção 1 — Netlify Drop (mais simples, sem GitHub)

```bash
npm install
npm run build
```

Depois arrasta a pasta `dist/` para [https://app.netlify.com/drop](https://app.netlify.com/drop).

### Opção 2 — Via GitHub

1. Push para GitHub
2. Netlify → New site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abre em http://localhost:5173

## Estrutura

```
atas-pro-v8/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
└── src/
    ├── main.jsx
    └── App.jsx          ← código completo da aplicação
```

## Stack

- React 18 + Vite 6
- docx + file-saver (geração DOCX para módulo Deliberações)
- Vanilla CSS (inline styles)
- Zero dependências externas para o módulo M&A
- localStorage para persistência

## Cruzamentos jurídicos implementados

1. **Doação de quotas → IS** (com cálculo automático conforme parentesco)
2. **Permuta de participações → Neutralidade fiscal** (CIRC arts. 73.º, 77.º)
3. **Cisão/Fusão/Entrada de ativos → Regime especial** (CIRC art. 73.º)
4. **Transmissão de estabelecimento → Laboral** (CT arts. 285.º e 286.º)
5. **Imóveis → IMT, IS, segregação** (CIMT art. 2.º n.º 2 al. d), EBF art. 60.º)
6. **Hipoteca → autorização bancária**
7. **Penhoras → bloqueante**
8. **Acordos parassociais → cláusulas restritivas**
9. **Sucessão → planeamento patrimonial**
10. **Share deal → due diligence**
11. **Multi-sociedade com imóveis → cenários múltiplos**
12. **SA envolvida → cuidados específicos**
13. **Prejuízos fiscais → reporte e antiabuso**
14. **Dívidas → certidões e covenants**

## Templates incluídos

- 🍽️ Venda de restaurante + imóvel
- 🏛️ Criação de holding familiar
- 👨‍👧 Doação de quotas a filhos

---

P&A Legal — uso interno
