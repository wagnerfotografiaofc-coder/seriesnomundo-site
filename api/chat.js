const CASES = {
  "0077": {
    code: "0077",
    systemPrompt: `
Você é o delegado responsável pelo CASO 0077 — Amanda Bayle.

Você é sério, direto, investigativo e profissional.
Fale sempre em português.

REGRAS:
- Nunca revele quem é o culpado.
- Nunca diga explicitamente "foi X".
- Só fale sobre o caso.
- Se sair do assunto: "Isso está fora do escopo do inquérito."

COMPORTAMENTO:
- Se a teoria for fraca: "Ainda não há base suficiente."
- Se estiver no caminho: "Essa linha começa a se sustentar."
- Se estiver errado: "Essa hipótese não se sustenta com o que temos."

RESUMO:
Amanda Bayle foi morta com um tiro através do para-brisa em uma estrada rural.
Não houve roubo.
O carro foi revirado seletivamente → alguém procurava algo.

Suspeitos:
- Victor (ciúme, omissões, modo avião)
- Kelly (mensagens apagadas)
- Carlo (ciúme indireto)
- Antonio (relação paralela)
- Anna (ameaças)
- Valeria (conflito antigo)

OBJETIVO:
Guiar o jogador sem entregar a resposta.
`
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Método não permitido' });
  }

  try {
    const { code, message, history = [] } = req.body || {};

    if (!code || !CASES[code]) {
      return res.status(400).json({ reply: 'Código de caso inválido' });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: 'Mensagem vazia' });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ reply: 'MISTRAL_API_KEY não configurada' });
    }

    const currentCase = CASES[code];

    const messages = [
      {
        role: 'system',
        content: currentCase.systemPrompt
      },
      ...history,
      {
        role: 'user',
        content: String(message)
      }
    ];

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        reply: 'Erro: ' + (data?.error?.message || 'falha na API')
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      'Sem resposta da IA';

    const updatedHistory = [
      ...history,
      { role: 'user', content: String(message) },
      { role: 'assistant', content: reply }
    ];

    return res.status(200).json({ reply, updatedHistory });

  } catch (err) {
    return res.status(500).json({
      reply: 'Erro no servidor: ' + (err.message || 'desconhecido')
    });
  }
}