# ATAS PRO v6

Ferramenta interna de documentação societária para sociedades por quotas.

## Novidades v6

- Passo de Identificação das Partes (dados reais, só em memória)
- 5 documentos complementares na cessão de quotas
- Botão "Selecionar todos" para pacote de saída de sócios
- Templates com linguagem extraída dos documentos reais

## Privacidade

- Estrutura pública da sociedade → localStorage
- Dados pessoais → APENAS memória de sessão
- Nada no servidor; nada persistido no browser

## Deploy — Netlify Drop

```
npm install
npm run build
```

Arrastar `dist/` para [app.netlify.com/drop](https://app.netlify.com/drop).

## Deploy — GitHub

```
git init && git add . && git commit -m "v6"
git remote add origin [URL]
git push -u origin main
```

Netlify: New Site → Import from Git. `netlify.toml` já configurado.

## Dev local

```
npm install
npm run dev
```
