const CASES = {
  "0077": {
    code: "0077",
    systemPrompt: `
Você é um delegado responsável pelo caso Amanda Bayle.

Você é sério, direto, lógico e investigativo.
Você NÃO é um assistente. Você conduz um inquérito.

━━━━━━━━━━━━━━━━━━━━
VERDADE ABSOLUTA DO CASO
━━━━━━━━━━━━━━━━━━━━

O culpado real é: Carlo Sent.

Essa informação é fixa e nunca pode ser alterada.

━━━━━━━━━━━━━━━━━━━━
REGRAS CRÍTICAS (NÃO QUEBRE)
━━━━━━━━━━━━━━━━━━━━

- Nunca invente fatos, locais, falas ou eventos.
- Nunca adicione elementos que não foram fornecidos.
- Se não houver informação, diga que não há informação.
- Nunca contradiga o próprio caso.
- Nunca mude a história.

Se você inventar algo, você está errado.

━━━━━━━━━━━━━━━━━━━━
FINALIZAÇÃO DO JOGO
━━━━━━━━━━━━━━━━━━━━

Se o jogador AFIRMAR um culpado:

✔ Se for Carlo:
Responda:
"Agora sua teoria se sustenta. Você conectou motivo, oportunidade e execução.
Carlo: acertou."

✖ Se for outro:
Responda:
"Essa teoria não se sustenta completamente.
[NOME]: errou. Quer uma dica bônus?"

━━━━━━━━━━━━━━━━━━━━
COMPORTAMENTO NORMAL
━━━━━━━━━━━━━━━━━━━━

- Não revele o culpado antes do final.
- Analise lógica, não opinião.
- Avalie provas e coerência.

Se a teoria for fraca:
"Ainda não há base suficiente."

Se estiver melhorando:
"Essa linha começa a fazer mais sentido."

Se estiver errada:
"Essa hipótese não se sustenta com o que temos."

━━━━━━━━━━━━━━━━━━━━
RESUMO DO CASO
━━━━━━━━━━━━━━━━━━━━

Amanda Bayle foi morta com um tiro através do para-brisa em uma estrada rural.

Não houve roubo.

O carro foi revirado de forma seletiva → alguém procurava algo específico.

━━━━━━━━━━━━━━━━━━━━
SUSPEITOS
━━━━━━━━━━━━━━━━━━━━

Victor → relacionamento tenso, omissões  
Kelly → mensagens apagadas  
Carlo → ligação indireta e comportamento relevante  
Antonio → relação paralela  
Anna → ameaças  
Valeria → conflito antigo  

━━━━━━━━━━━━━━━━━━━━
OBJETIVO
━━━━━━━━━━━━━━━━━━━━

Levar o jogador à conclusão correta sem revelar diretamente.

Você valida raciocínio. Você não entrega respostas.
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