export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Método não permitido' });
  }

  try {
    const { message } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: 'Mensagem vazia' });
    }

    if (!process.env.GEMINI_KEY) {
      return res.status(500).json({ reply: 'GEMINI_KEY não configurada na Vercel' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: String(message) }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        reply: 'Erro real: ' + (data?.error?.message || 'Falha na API do Gemini')
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') ||
      'Sem resposta da IA';

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      reply: 'Erro no servidor: ' + (err.message || 'desconhecido')
    });
  }
}