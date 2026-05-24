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

function buildPrompt({ briefing, index, total }) {
    return `Voce e um redator SEO brasileiro do site SeriesNoMundo, especializado em filmes, series e streaming.

Crie o post ${index} de ${total} usando a ideia abaixo.

REGRAS OBRIGATORIAS:
- Escreva em portugues do Brasil.
- Tom humano, leve, divertido e natural, como um redator experiente de entretenimento.
- Nao use linguagem robotica, repetitiva ou generica.
- O post deve ter entre 800 e 1200 palavras.
- Use SEO sem parecer forçado.
- Crie titulo forte, meta description objetiva, categoria, tags e conteudo HTML.
- A categoria deve ser exatamente Filmes ou Series.
- Nao invente noticias recentes como se fossem confirmadas.
- Se falar de catalogo de streaming, use linguagem segura como "pode variar conforme a regiao e o periodo".
- Nao coloque fontes consultadas.
- Nao coloque slug.
- Entregue somente no formato abaixo, sem explicacoes antes ou depois.

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
<h2>...</h2>
<p>...</p>

IDEIA/BASE DO POST:
${briefing}`;
}

async function generateSinglePost({ apiKey, briefing, index, total }) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: 'Voce gera posts de entretenimento em formato estruturado para importacao em CMS. Responda apenas com o conteudo solicitado.'
                },
                {
                    role: 'user',
                    content: buildPrompt({ briefing, index, total })
                }
            ],
            temperature: 0.75,
            max_tokens: 3600
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error?.message || 'Erro ao chamar a DeepSeek.';
        throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('A DeepSeek respondeu vazio.');
    return content;
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

    const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const isLoggedIn = await validateSupabaseSession(token);
    if (!isLoggedIn) {
        return sendJson(response, 401, { error: 'Login invalido ou expirado.' });
    }

    const count = Math.min(10, Math.max(1, parseInt(request.body?.count, 10) || 1));
    const briefingsText = String(request.body?.briefings || '').trim();

    if (!briefingsText) {
        return sendJson(response, 400, { error: 'Envie pelo menos uma ideia de post.' });
    }

    if (briefingsText.length > 30000) {
        return sendJson(response, 400, { error: 'O texto esta grande demais. Divida em partes menores.' });
    }

    const sections = splitBriefings(briefingsText);
    try {
        const postRequests = Array.from({ length: count }, (_item, itemIndex) => {
            const index = itemIndex + 1;
            const briefing = sections[index - 1] || briefingsText;
            return generateSinglePost({ apiKey, briefing, index, total: count });
        });

        const posts = await Promise.all(postRequests);

        return sendJson(response, 200, { content: posts.join('\n\n\n') });
    } catch (error) {
        return sendJson(response, 502, { error: error.message || 'Erro ao gerar posts.' });
    }
};
