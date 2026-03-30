export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Método não permitido' });
  }

  try {
    const { message } = req.body;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        reply: "Erro: " + (data?.error?.message || "falha na API")
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sem resposta";

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({
      reply: "Erro no servidor"
    });
  }
}