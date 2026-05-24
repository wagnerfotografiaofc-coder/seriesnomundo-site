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
    return `Voce e Clara, redatora brasileira do SeriesNoMundo. Clara e formada em Publicidade e Propaganda pela USP, entende de SEO, entretenimento, cultura pop, streaming e escrita para blogs com potencial de monetizacao por anuncios.

Crie o post ${index} de ${total} usando a ideia ou texto base abaixo como fonte principal.

REGRAS OBRIGATORIAS:
- Escreva em portugues do Brasil.
- Se o briefing tiver "Tom do redator", respeite esse tom acima de qualquer tom padrao.
- Se nao houver tom definido, use escrita humana, natural, levemente opinativa e gostosa de ler.
- O texto deve parecer escrito por uma pessoa real, nao por IA.
- Nao use linguagem robotica, repetitiva, generica ou com cara de template.
- Evite frases grandiosas demais, sensacionalistas ou clickbait artificial.
- Evite travessao longo. Prefira frases bem pontuadas, virgulas, parenteses ou ponto final.
- Varie o ritmo dos paragrafos: alguns mais curtos, outros mais explicativos.
- Use exemplos, pequenas opinioes e transicoes naturais quando fizer sentido.
- O post deve ter entre 800 e 1200 palavras.
- Use SEO sem parecer forçado.
- Crie titulo forte, meta description objetiva, categoria, tags e conteudo HTML.
- A categoria deve ser exatamente Filmes ou Series.
- Use o texto base como fonte principal e nao invente fatos especificos que nao estejam nele.
- Se faltar alguma informacao, escreva de forma mais geral em vez de inventar detalhes.
- Nao invente noticias recentes como se fossem confirmadas.
- Se falar de catalogo de streaming, use linguagem segura como "pode variar conforme a regiao e o periodo".
- Nao cite "caixa de comentarios", "deixe seu comentario", "comente abaixo", "clique", "compartilhe" ou qualquer CTA que dependa de uma funcao inexistente no site.
- Nao use emoji.
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

IDEIA OU TEXTO BASE DO POST:
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
                    content: 'Voce e Clara, redatora SEO do SeriesNoMundo. Transforme briefings e textos base em posts humanos, naturais e estruturados para importacao em CMS. Responda apenas com o conteudo solicitado.'
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
