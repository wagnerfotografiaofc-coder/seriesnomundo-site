const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const MODEL_CONFIG = {
    'deepseek-flash': {
        provider: 'deepseek',
        model: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-chat',
        inputPrice: 0.14,
        outputPrice: 0.28,
        maxOutput: 2500
    },
    'deepseek-pro': {
        provider: 'deepseek',
        model: process.env.DEEPSEEK_PRO_MODEL || 'deepseek-reasoner',
        inputPrice: 0.435,
        outputPrice: 0.87,
        maxOutput: 2500
    },
    'claude-haiku': {
        provider: 'anthropic',
        model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5',
        inputPrice: 1,
        outputPrice: 5,
        maxOutput: 1500
    },
    'claude-sonnet': {
        provider: 'anthropic',
        model: process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6',
        inputPrice: 3,
        outputPrice: 15,
        maxOutput: 1500
    },
    'claude-opus': {
        provider: 'anthropic',
        model: process.env.CLAUDE_OPUS_MODEL || 'claude-opus-4-8',
        inputPrice: 5,
        outputPrice: 25,
        maxOutput: 1500
    }
};

const MASTER_PROMPT = `
Voce e o assistente interno da Psilu, uma empresa de gestao de software para psicologos.
Quando estiver usando DeepSeek, foque em operacao: criar tarefas, organizar calendario, resumir docs e preparar briefings.
Quando estiver usando Claude, aja como CMO: diagnostique gargalos, proponha hipoteses, priorize testes e evite respostas genericas.
Nunca afirme que executou uma acao fora do painel. Quando sugerir tarefas, eventos ou estrategias, deixe claro que precisam de aprovacao.
Nunca diga "criei", "salvei", "adicionei" ou "marquei" uma tarefa/evento/doc se a acao ainda nao foi aprovada pelo Bruno no painel.
Quando o usuario pedir para criar algo, responda como "Sugestao preparada para aprovacao" e liste os campos propostos.
Para analises CMO, responda com: diagnostico, evidencias, proximo teste e decisao recomendada.
Se faltar contexto real, diga exatamente qual contexto precisa em vez de inventar.
Seja objetivo. Use o menor tamanho necessario e nunca escreva relatorio longo sem necessidade.
`;

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = getBearerToken(request);
        await requireUser(token);

        const body = parseBody(request.body);
        const selectedConfig = MODEL_CONFIG[body.modelId] || MODEL_CONFIG['deepseek-flash'];
        const maxOutputTokens = Math.min(Number(body.maxOutputTokens || selectedConfig.maxOutput), selectedConfig.maxOutput);
        const contextText = buildContextText(body.context);
        const userMessage = String(body.message || '').trim();

        if (!userMessage) {
            return response.status(400).json({ error: 'Mensagem vazia.' });
        }

        const prompt = [
            contextText ? `CONTEXTO ANEXADO:\n${contextText}` : '',
            `MENSAGEM DO BRUNO:\n${userMessage}`
        ].join('\n\n');

        const result = selectedConfig.provider === 'anthropic'
            ? await callAnthropic(selectedConfig, prompt, maxOutputTokens)
            : await callDeepSeek(selectedConfig, prompt, maxOutputTokens);

        const inputTokens = result.inputTokens || estimateTokens(`${MASTER_PROMPT}\n${prompt}`);
        const outputTokens = result.outputTokens || estimateTokens(result.text);
        const estimatedCost = calculateCost(inputTokens, outputTokens, selectedConfig);

        return response.status(200).json({
            text: result.text,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCost,
                maxOutputTokens
            },
            suggestedActions: extractSuggestedActions(result.text)
        });
    } catch (error) {
        return response.status(error.statusCode || 500).json({ error: error.message || 'Erro interno.' });
    }
};

async function requireUser(token) {
    if (!token) {
        const error = new Error('Sessao obrigatoria.');
        error.statusCode = 401;
        throw error;
    }

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY
        }
    });

    if (!authResponse.ok) {
        const error = new Error('Sessao invalida.');
        error.statusCode = 401;
        throw error;
    }
}

async function callDeepSeek(config, prompt, maxTokens) {
    if (!process.env.DEEPSEEK_API_KEY) {
        return {
            text: 'DeepSeek ainda nao esta configurado. Adicione DEEPSEEK_API_KEY na Vercel para ativar este modelo.'
        };
    }

    const apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: MASTER_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.4
        })
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(data.error?.message || 'Erro no DeepSeek.');

    return {
        text: data.choices?.[0]?.message?.content || '',
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens
    };
}

async function callAnthropic(config, prompt, maxTokens) {
    if (!process.env.ANTHROPIC_API_KEY) {
        return {
            text: 'Claude ainda nao esta configurado. Adicione ANTHROPIC_API_KEY na Vercel para ativar Haiku, Sonnet e Opus.'
        };
    }

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: Math.min(maxTokens, 1500),
            temperature: 0.35,
            system: MASTER_PROMPT,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(data.error?.message || 'Erro no Claude.');

    return {
        text: data.content?.map(part => part.text || '').join('\n').trim() || '',
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens
    };
}

function getBearerToken(request) {
    return String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function buildContextText(context) {
    if (!Array.isArray(context) || !context.length) return '';
    return context.map(item => {
        const label = item.label || item.type || 'contexto';
        return `## ${label}\n${JSON.stringify(item.data || [], null, 2)}`;
    }).join('\n\n').slice(0, 24000);
}

function estimateTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

function calculateCost(inputTokens, outputTokens, config) {
    return Number(((inputTokens / 1000000) * config.inputPrice + (outputTokens / 1000000) * config.outputPrice).toFixed(6));
}

function extractSuggestedActions(text) {
    const taskMatches = String(text || '').match(/(?:tarefa|acao recomendada|proximo teste):\s*(.+)/gi) || [];
    return taskMatches.slice(0, 3).map(match => ({
        title: match.split(':').slice(1).join(':').trim() || 'Acao sugerida',
        description: 'Revise antes de aprovar no painel.'
    }));
}

function parseBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_error) {
            return {};
        }
    }
    return body;
}
