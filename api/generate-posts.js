const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

function sendJson(response, statusCode, payload) {
    response.status(statusCode).json(payload);
}

function splitBriefings(rawText) {
    return String(rawText || '')
        .split(/\n\s*(?:---+|###)\s*\n/g)
        .map(section => section.trim())
        .filter(Boolean);
}

async function validateSupabaseSession(token) {
    if (!token) return false;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
        }
    });

    return response.ok;
}

function createApiError(message, details = {}) {
    const error = new Error(message);
    error.details = details;
    return error;
}

function buildPrompt({ briefing, index, total }) {
    return `Voce e Clara, redatora brasileira do SeriesNoMundo. Transforme o texto base abaixo em um post SEO humano, claro e seguro para Google Search e Ads.

Regras:
- Use portugues brasileiro com acentos corretos em titulo, meta, tags, h2 e paragrafos.
- Respeite "Tom do redator" se existir. Sem tom definido, escreva de forma natural, calma e levemente opinativa.
- Use somente fatos do texto base. Nao complete filmografia, datas, plataformas, bilheteria, titulos anteriores ou bastidores por memoria.
- Para curiosidades, numeros e bastidores vindos da base, use atribuicoes como "segundo relatos", "em entrevistas da epoca" ou "dados de bilheteria apontam".
- Nao use travessao longo. O caractere "—" e proibido.
- Evite clickbait e superlativos vagos como "avassalador", "revolucionario", "imperdivel", "definitivo", "obra-prima" e "marco absoluto", salvo se a base pedir esse tom.
- Nao use emoji, slug, fontes consultadas, "comente abaixo", "clique" ou "compartilhe".
- Se falar de streaming, use: "a disponibilidade pode variar conforme a regiao e o periodo".
- Se varios posts forem sobre o mesmo tema, mire uma intencao de busca diferente.

Estrutura obrigatoria:
- Exatamente 4 subtitulos em <h2>.
- Exatamente 4 paragrafos em <p> por subtitulo.
- Cada paragrafo deve ter 2 a 4 frases completas.
- O post final deve ter no minimo 600 palavras. Ideal: 600 a 750 palavras.
- Para crescer sem enrolar, use detalhes do texto base, analise de personagens, contexto, impacto no publico e diferencas entre fases.
- Nao escreva introducao antes do primeiro <h2> nem conclusao fora desses 4 blocos.

FORMATO EXATO:
Titulo SEO:
...

Meta description:
...

Categoria:
Filmes ou Series

Tags:
tag 1, tag 2, tag 3, tag 4, tag 5, tag 6

Conteudo HTML:

<h2>...</h2>
<p>...</p>
<p>...</p>
<p>...</p>
<p>...</p>
<h2>...</h2>
<p>...</p>
<p>...</p>
<p>...</p>
<p>...</p>
<h2>...</h2>
<p>...</p>
<p>...</p>
<p>...</p>
<p>...</p>
<h2>...</h2>
<p>...</p>
<p>...</p>
<p>...</p>
<p>...</p>

TEXTO BASE DO POST:
${briefing}`;
}
const COMMON_ACCENT_ISSUES = [
    /\bvoce\b/i,
    /\bnao\b/i,
    /\btambem\b/i,
    /\bcomedia\b/i,
    /\banimacao\b/i,
    /\bpublico\b/i,
    /\bcritica\b/i,
    /\bsequencia\b/i,
    /\bmudanca\b/i,
    /\bgenero\b/i,
    /\bcoracao\b/i,
    /\blancad[ao]s?\b/i,
    /\btecnic[ao]s?\b/i,
    /\bestudio\b/i,
    /\bhistoria\b/i,
    /\bclassico\b/i,
    /\bfamilia\b/i,
    /\brelampago\b/i,
    /\bincriveis\b/i,
    /\be considerado\b/i
];

function removeLongDashes(content) {
    return String(content || '').replace(/\s*—\s*/g, ', ');
}

function needsEditorialPolish(content) {
    return content.includes('—') || COMMON_ACCENT_ISSUES.some(pattern => pattern.test(content));
}

function buildPolishPrompt(content) {
    return `Revise o texto abaixo para publicacao no SeriesNoMundo.

TAREFA:
- Corrigir acentos e ortografia do portugues brasileiro.
- Remover todos os travessoes longos. O caractere "—" e proibido.
- Manter exatamente o mesmo formato: Titulo SEO, Meta description, Categoria, Tags e Conteudo HTML.
- Manter exatamente 4 subtitulos <h2>, com exatamente 4 paragrafos <p> em cada subtitulo.
- Manter no minimo 600 palavras no Conteudo HTML.
- Manter as mesmas ideias, fatos, titulos, tags e estrutura HTML.
- Nao adicionar fatos novos.
- Nao resumir.
- Nao explicar a revisao.
- Responder somente com o texto final corrigido.

TEXTO:
${content}`;
}

async function polishGeneratedPost({ apiKey, content, index }) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            thinking: { type: 'disabled' },
            messages: [
                {
                    role: 'system',
                    content: 'Voce e uma revisora de portugues brasileiro. Corrija apenas acentos, ortografia e pontuacao, sem mudar o conteudo.'
                },
                {
                    role: 'user',
                    content: buildPolishPrompt(content)
                }
            ],
            temperature: 0.15,
            max_tokens: 5200
        })
    });

    const responseText = await response.text();
    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (_error) {
        throw createApiError(`Resposta invalida da DeepSeek ao revisar o post ${index}.`, {
            stage: 'polish',
            post: index,
            status: response.status,
            responsePreview: responseText.slice(0, 300)
        });
    }

    if (!response.ok) {
        const message = data?.error?.message || `Erro ao revisar o post ${index}.`;
        throw createApiError(message, {
            stage: 'polish',
            post: index,
            status: response.status,
            deepseekError: data?.error
        });
    }

    const polishedContent = data?.choices?.[0]?.message?.content?.trim();
    if (!polishedContent) {
        throw createApiError(`A revisao respondeu vazia no post ${index}.`, {
            stage: 'polish',
            post: index,
            finishReason: data?.choices?.[0]?.finish_reason
        });
    }
    return removeLongDashes(polishedContent);
}

async function callDeepSeek({ apiKey, briefing, index, total, temperature }) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            thinking: { type: 'disabled' },
            messages: [
                {
                    role: 'system',
                    content: 'Voce e Clara, redatora SEO do SeriesNoMundo. Transforme briefings e textos base em posts humanos, naturais e estruturados para importacao em CMS. Responda apenas com o conteudo solicitado.'
                },
                {
                    role: 'user',
                    content: buildPrompt({ briefing, index, total })
                }
            ],
            temperature,
            max_tokens: 5000
        })
    });

    const responseText = await response.text();
    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (_error) {
        throw createApiError(`Resposta invalida da DeepSeek ao gerar o post ${index}.`, {
            stage: 'generate',
            post: index,
            status: response.status,
            responsePreview: responseText.slice(0, 300)
        });
    }

    if (!response.ok) {
        const message = data?.error?.message || 'Erro ao chamar a DeepSeek.';
        throw createApiError(message, {
            stage: 'generate',
            post: index,
            status: response.status,
            deepseekError: data?.error
        });
    }

    const choice = data?.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
        const reason = choice?.finish_reason ? ` Motivo: ${choice.finish_reason}.` : '';
        throw createApiError(`A DeepSeek respondeu vazio no post ${index}.${reason}`, {
            stage: 'generate',
            post: index,
            finishReason: choice?.finish_reason
        });
    }
    return content;
}

async function generateSinglePost({ apiKey, briefing, index, total }) {
    let content;

    try {
        content = await callDeepSeek({ apiKey, briefing, index, total, temperature: 0.62 });
    } catch (error) {
        if (!error.message.includes('respondeu vazio')) throw error;
        content = await callDeepSeek({ apiKey, briefing, index, total, temperature: 0.45 });
    }

    content = removeLongDashes(content);
    if (needsEditorialPolish(content)) {
        content = await polishGeneratedPost({ apiKey, content, index });
    }

    return removeLongDashes(content);
}

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return sendJson(response, 405, { error: 'Metodo nao permitido.' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return sendJson(response, 500, { error: 'A chave DEEPSEEK_API_KEY ainda nao foi configurada na Vercel.' });
    }
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const isLoggedIn = await validateSupabaseSession(token);
    if (!isLoggedIn) {
        return sendJson(response, 401, { error: 'Login invalido ou expirado.' });
    }

    const requestedCount = Math.min(10, Math.max(1, parseInt(request.body?.count, 10) || 1));
    const briefingsText = String(request.body?.briefings || '').trim();

    if (requestedCount > 1) {
        return sendJson(response, 400, {
            error: 'Por seguranca contra timeout e gasto de credito, a API agora gera 1 post por chamada. Recarregue a pagina do gerador e tente novamente.'
        });
    }

    const count = 1;

    if (!briefingsText) {
        return sendJson(response, 400, { error: 'Envie pelo menos uma ideia de post.' });
    }

    if (briefingsText.length > 30000) {
        return sendJson(response, 400, { error: 'O texto esta grande demais. Divida em partes menores.' });
    }

    const sections = splitBriefings(briefingsText);
    try {
        const startedAt = Date.now();
        const postRequests = Array.from({ length: count }, (_item, itemIndex) => {
            const index = itemIndex + 1;
            const briefing = sections[index - 1] || briefingsText;
            return generateSinglePost({ apiKey, briefing, index, total: count });
        });

        const results = await Promise.allSettled(postRequests);
        const failedResult = results.find(result => result.status === 'rejected');
        if (failedResult) throw failedResult.reason;

        const posts = results.map(result => result.value);

        return sendJson(response, 200, {
            content: posts.join('\n\n\n'),
            debug: {
                model,
                count,
                seconds: Math.round((Date.now() - startedAt) / 1000)
            }
        });
    } catch (error) {
        return sendJson(response, 502, {
            error: error.message || 'Erro ao gerar posts.',
            debug: {
                model,
                count,
                stage: error.details?.stage || 'unknown',
                post: error.details?.post || null,
                status: error.details?.status || null,
                finishReason: error.details?.finishReason || null,
                responsePreview: error.details?.responsePreview || null,
                deepseekError: error.details?.deepseekError || null
            }
        });
    }
};
