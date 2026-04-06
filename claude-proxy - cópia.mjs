// netlify/functions/claude-proxy.mjs
// Proxy para a API do Claude — resolve CORS e protege a API key

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const ANTHROPIC_API_KEY = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada. Vá a Site Settings → Environment Variables no Netlify e adicione a chave." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { system, prompt } = body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: system || "",
        messages: [{ role: "user", content: prompt || "" }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errData.error?.message || `Erro da API Anthropic: HTTP ${response.status}` }), { status: response.status, headers: { "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const text = data.content?.map(b => b.type === "text" ? b.text : "").join("\n") || "";

    return new Response(JSON.stringify({ text }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno do proxy" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const config = {
  path: "/.netlify/functions/claude-proxy",
};
