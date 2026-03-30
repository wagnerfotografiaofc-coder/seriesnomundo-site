import { CASE_DATA } from "../lib/caseData.js";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectFinalGuess(message) {
  const text = normalizeText(message);

  const patterns = [
    { name: "carlo", regexes: [/foi o carlo/, /foi carlo/, /o assassino e o carlo/, /o assassino e carlo/, /culpado e o carlo/, /culpado e carlo/] },
    { name: "victor", regexes: [/foi o victor/, /foi victor/, /o assassino e o victor/, /o assassino e victor/, /culpado e o victor/, /culpado e victor/] },
    { name: "kelly", regexes: [/foi a kelly/, /foi kelly/, /a assassina e a kelly/, /a assassina e kelly/, /culpada e a kelly/, /culpada e kelly/] },
    { name: "anna", regexes: [/foi a anna/, /foi anna/, /a assassina e a anna/, /a assassina e anna/, /culpada e a anna/, /culpada e anna/] },
    { name: "antonio", regexes: [/foi o antonio/, /foi antonio/, /o assassino e o antonio/, /o assassino e antonio/, /culpado e o antonio/, /culpado e antonio/] },
    { name: "valeria", regexes: [/foi a valeria/, /foi valeria/, /a assassina e a valeria/, /a assassina e valeria/, /culpada e a valeria/, /culpada e valeria/] }
  ];

  for (const suspect of patterns) {
    if (suspect.regexes.some((r) => r.test(text))) {
      return suspect.name;
    }
  }

  return null;
}

function formatWrongName(name) {
  const map = {
    victor: "Victor",
    kelly: "Kelly",
    anna: "Anna",
    antonio: "Antonio",
    valeria: "Valeria"
  };
  return map[name] || name;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Método não permitido" });
  }

  try {
    const { code, message, history = [] } = req.body || {};

    if (!code || !CASE_DATA[code]) {
      return res.status(400).json({ reply: "Código de caso inválido" });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: "Mensagem vazia" });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ reply: "MISTRAL_API_KEY não configurada" });
    }

    const currentCase = CASE_DATA[code];
    const guessed = detectFinalGuess(message);

    if (guessed === currentCase.solution) {
      const reply = `Você encerrou a investigação com uma teoria que se sustenta.

Carlo: acertou.`;

      const updatedHistory = [
        ...history,
        { role: "user", content: String(message) },
        { role: "assistant", content: reply }
      ];

      return res.status(200).json({ reply, updatedHistory });
    }

    if (guessed && guessed !== currentCase.solution) {
      const wrongName = formatWrongName(guessed);

      const reply = `Essa teoria não se sustenta completamente.

${wrongName}: errou. Quer uma dica bônus?`;

      const updatedHistory = [
        ...history,
        { role: "user", content: String(message) },
        { role: "assistant", content: reply }
      ];

      return res.status(200).json({ reply, updatedHistory });
    }

    const systemPrompt = `
${currentCase.factsText}

INSTRUÇÕES DE COMPORTAMENTO
INSTRUÇÕES DE COMPORTAMENTO
- Você é ${currentCase.detectiveName}.
- Seu status é: ${currentCase.detectiveStatus}.
- Você é um delegado sério, preciso, lógico e investigativo.

REGRAS CRÍTICAS:
- Você NÃO pode confundir nomes.
- Você NÃO pode trocar personagens.
- Você NÃO pode assumir coisas.
- Você NÃO pode inferir além do que está no texto.

REGRA ABSOLUTA:
- Sempre responda EXATAMENTE com base no texto do caso.
- Se a resposta estiver no texto, repita fielmente.
- Se não tiver certeza absoluta, diga:
"Essa informação não consta com clareza no inquérito."

IMPORTANTE:
- Nunca troque Clara por Anna.
- Nunca misture personagens.
- Nunca reescreva fatos.
- Nunca invente interpretação.

COMO RESPONDER:
- Resposta direta → seja objetivo
- Resposta analítica → use apenas fatos reais do caso
- Dúvida → diga que não consta

- Nunca revele diretamente o culpado durante a investigação.
- Se sair do tema → "Isso está fora do escopo do inquérito."
- No máximo 3 parágrafos.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history,
      {
        role: "user",
        content: String(message)
      }
    ];

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages,
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        reply: "Erro: " + (data?.error?.message || "falha na API")
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sem resposta da IA";

    const updatedHistory = [
      ...history,
      { role: "user", content: String(message) },
      { role: "assistant", content: reply }
    ];

    return res.status(200).json({ reply, updatedHistory });
  } catch (err) {
    return res.status(500).json({
      reply: "Erro no servidor: " + (err.message || "desconhecido")
    });
  }
}