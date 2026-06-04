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
Quando sugerir uma acao que o painel pode aprovar, inclua tambem um bloco oculto no fim:
ACAO_SUGERIDA_JSON
[{"type":"task|event|editorial|doc|strategy","title":"...","description":"...","payload":{"title":"...","description":"..."}}]
FIM_ACAO_SUGERIDA_JSON
O texto visivel deve continuar humano e curto.
Para analises CMO, responda com: diagnostico, evidencias, proximo teste e decisao recomendada.
Se houver CONTEXTO ANEXADO, use esse contexto como fonte real do painel. Nao diga que nao tem acesso ao painel quando o contexto anexado trouxer tarefas, calendario, docs ou estrategias.
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

        const actionExtraction = extractSuggestedActions(result.text, userMessage);
        const finalText = actionExtraction.text;
        const inputTokens = result.inputTokens || estimateTokens(`${MASTER_PROMPT}\n${prompt}`);
        const outputTokens = result.outputTokens || estimateTokens(finalText);
        const estimatedCost = calculateCost(inputTokens, outputTokens, selectedConfig);

        return response.status(200).json({
            text: finalText,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCost,
                maxOutputTokens
            },
            suggestedActions: actionExtraction.actions
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

function extractSuggestedActions(rawText, userMessage) {
    let text = String(rawText || '').trim();
    const actions = [];
    const jsonBlock = text.match(/ACAO_SUGERIDA_JSON\s*([\s\S]*?)\s*FIM_ACAO_SUGERIDA_JSON/i);

    if (jsonBlock) {
        try {
            const parsed = JSON.parse(jsonBlock[1].trim());
            if (Array.isArray(parsed)) {
                parsed.forEach(action => actions.push(normalizeAction(action, userMessage)));
            }
        } catch (_error) {
            actions.push(...inferActionsFromText(userMessage, text));
        }
        text = text.replace(jsonBlock[0], '').trim();
    }

    if (!actions.length) {
        actions.push(...inferActionsFromText(userMessage, text));
    }

    return {
        text,
        actions: actions.filter(Boolean).slice(0, 4)
    };
}

function inferActionsFromText(userMessage, assistantText) {
    const source = `${userMessage}\n${assistantText}`;
    const normalized = normalizeForSearch(source);
    const wantsCreate = /\b(crie|criar|adicione|adicionar|marque|marcar|agende|agendar|coloque|colocar|registre|registrar|prepare)\b/.test(normalized);
    if (!wantsCreate) return [];

    if (/\b(tarefa|tarefas|task|pendencia)\b/.test(normalized)) {
        const title = inferTitle(userMessage, 'Tarefa sugerida');
        return [normalizeAction({
            type: 'task',
            title,
            description: `Sugestao preparada a partir do pedido: ${userMessage}`,
            payload: {
                title,
                description: '',
                status: 'a_fazer',
                priority: 'media',
                origin: 'ia'
            }
        }, userMessage)];
    }

    if (/\b(calendario|agenda|evento|reuniao|compromisso)\b/.test(normalized)) {
        const title = inferTitle(userMessage, 'Evento sugerido');
        return [normalizeAction({
            type: 'event',
            title,
            description: `Sugestao preparada a partir do pedido: ${userMessage}`,
            payload: {
                title,
                description: '',
                event_type: normalized.includes('reuniao') ? 'reuniao' : 'operacao'
            }
        }, userMessage)];
    }

    if (/\b(editorial|post|conteudo|instagram|tiktok|email|whatsapp)\b/.test(normalized)) {
        const title = inferTitle(userMessage, 'Item editorial sugerido');
        return [normalizeAction({
            type: 'editorial',
            title,
            description: `Sugestao preparada a partir do pedido: ${userMessage}`,
            payload: { title, channel: inferChannel(normalized), status: 'ideia' }
        }, userMessage)];
    }

    if (/\b(doc|documento|icp|concorrente|produto|oferta)\b/.test(normalized)) {
        const title = inferTitle(userMessage, 'Documento sugerido');
        return [normalizeAction({
            type: 'doc',
            title,
            description: `Sugestao preparada a partir do pedido: ${userMessage}`,
            payload: { title, category: 'Outro', content: '' }
        }, userMessage)];
    }

    if (/\b(estrategia|estrategias|teste|prospeccao)\b/.test(normalized)) {
        const title = inferTitle(userMessage, 'Estrategia sugerida');
        return [normalizeAction({
            type: 'strategy',
            title,
            description: `Sugestao preparada a partir do pedido: ${userMessage}`,
            payload: { title, category: 'Marketing', description: '' }
        }, userMessage)];
    }

    return [];
}

function normalizeAction(action, userMessage) {
    if (!action || typeof action !== 'object') return null;
    const type = normalizeActionType(action.type || action.action_type);
    if (!type) return null;
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const title = String(action.title || payload.title || 'Acao sugerida').trim();
    return {
        type,
        title,
        description: String(action.description || 'Revise os campos antes de aprovar no painel.').trim(),
        payload: { ...payload, title: payload.title || title },
        sourceMessage: userMessage
    };
}

function normalizeActionType(type) {
    const normalized = normalizeForSearch(type).replace(/^create_/, '');
    if (['task', 'event', 'editorial', 'doc', 'strategy'].includes(normalized)) return normalized;
    if (normalized === 'calendar') return 'event';
    if (normalized === 'document') return 'doc';
    return null;
}

function inferTitle(message, fallback) {
    const text = String(message || '').trim();
    const quoted = text.match(/["“'`](.+?)["”'`]/);
    if (quoted) return cleanTitle(quoted[1], fallback);

    const named = text.match(/(?:chamada|chamado|titulo|t[íi]tulo|nomeada|nomeado)\s+(.+?)(?:\.|,|$)/i);
    if (named) return cleanTitle(named[1], fallback);

    const afterFor = text.match(/(?:tarefa|evento|reuniao|reuni[ãa]o|estrategia|estrat[ée]gia|documento)\s+(?:para|de)?\s*(.+?)(?:\s+(?:para|no|na|dia|amanh[ãa]|hoje|as|às)\b|\.|,|$)/i);
    if (afterFor) return cleanTitle(afterFor[1], fallback);

    return fallback;
}

function cleanTitle(value, fallback) {
    const title = String(value || '')
        .replace(/\b(para|amanha|amanhã|hoje|as|às|dia)\b.*$/i, '')
        .trim();
    return title || fallback;
}

function inferChannel(normalizedText) {
    if (normalizedText.includes('tiktok')) return 'TikTok';
    if (normalizedText.includes('email')) return 'Email';
    if (normalizedText.includes('whatsapp')) return 'WhatsApp';
    if (normalizedText.includes('blog')) return 'Blog';
    return 'Instagram';
}

function normalizeForSearch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
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
