// Netlify Function: claude-proxy
// Proxy para a API do Claude

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY nao configurada nas Environment Variables do Netlify." })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Body invalido: " + e.message }) };
  }

  const { system, prompt } = body;
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Prompt em falta" }) };
  }

  try {
    console.log("Calling Anthropic API...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: system || "",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    console.log("Anthropic status:", response.status);
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = "Erro HTTP " + response.status;
      try {
        const errData = JSON.parse(responseText);
        errorMessage = (errData.error && errData.error.message) || errorMessage;
      } catch (e) {
        errorMessage = responseText.substring(0, 500) || errorMessage;
      }
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errorMessage }) };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Resposta invalida: " + responseText.substring(0, 300) }) };
    }

    const text = (data.content || []).map(function(b) { return b.type === "text" ? b.text : ""; }).join("\n");

    return { statusCode: 200, headers, body: JSON.stringify({ text: text }) };
  } catch (e) {
    console.error("Function error:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno: " + (e.message || String(e)) }) };
  }
};
