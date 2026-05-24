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

Crie o post ${index} de ${total} usando a ideia ou texto base abaixo como fonte principal. Sua funcao nao e inventar um post do zero. Sua funcao e transformar a base enviada em um artigo melhor, mais claro, mais humano e pronto para o site.

PRIORIDADES:
1. Portugues brasileiro correto, com acentos em todos os campos.
2. Fidelidade ao texto base.
3. Tom humano de redatora, sem cara de IA.
4. SEO natural e seguro para Google Search e Ads.
5. Formato exato para importacao.

REGRAS OBRIGATORIAS:
- Escreva em portugues do Brasil.
- Use acentos corretamente em todas as palavras em portugues, inclusive titulo, meta description, tags, h2 e paragrafos. Nunca escreva "voce", "nao", "e considerado", "tambem", "comedia", "animacao", "publico", "critica", "sequencia", "mudanca", "genero", "coracao", "lancado" ou "tecnico" sem acento.
- Nao misture ingles no texto, a menos que seja nome oficial de obra, plataforma, personagem, programa ou termo indispensavel.
- Se o briefing tiver "Tom do redator", respeite esse tom acima de qualquer tom padrao.
- Se nao houver tom definido, use escrita humana, natural, levemente opinativa e gostosa de ler.
- O texto deve parecer escrito por uma pessoa real, nao por IA.
- Nao use linguagem robotica, repetitiva, generica ou com cara de template.
- Evite frases grandiosas demais, sensacionalistas ou clickbait artificial.
- Nao use travessao longo. O caractere "—" e proibido na resposta. Use virgulas, dois-pontos, parenteses ou ponto final.
- Varie o ritmo dos paragrafos: alguns mais curtos, outros mais explicativos.
- Use exemplos, pequenas opinioes e transicoes naturais quando fizer sentido.
- O post deve ter entre 800 e 1200 palavras.
- Use SEO sem parecer forçado.
- Crie titulo forte, meta description objetiva, categoria, tags e conteudo HTML.
- A categoria deve ser exatamente Filmes ou Series.
- Use o texto base como fonte principal e nao invente fatos especificos que nao estejam nele.
- Curiosidades, bastidores, bilheteria, datas, locais de filmagem, valores, nomes de atores e eventos reais so podem entrar se estiverem no texto base.
- Quando mencionar curiosidades, bastidores, rumores, entrevistas, valores, numeros ou informacoes que dependem de fonte externa, use atribuicoes seguras como "segundo relatos", "de acordo com informacoes divulgadas na epoca", "em entrevistas da epoca" ou "dados de bilheteria apontam".
- Nao apresente curiosidades de bastidor como certeza absoluta se o texto base nao trouxer uma fonte clara.
- Nao repita "segundo relatos" em todos os paragrafos. Varie a atribuicao para o texto continuar natural.
- Se faltar alguma informacao, escreva de forma mais geral em vez de inventar detalhes.
- Nao invente noticias recentes como se fossem confirmadas.
- Se falar de catalogo de streaming, use linguagem segura como "pode variar conforme a regiao e o periodo".
- Nao cite "caixa de comentarios", "deixe seu comentario", "comente abaixo", "clique", "compartilhe" ou qualquer CTA que dependa de uma funcao inexistente no site.
- Nao use emoji.
- Se varios posts forem sobre o mesmo filme ou serie, cada post precisa mirar uma intencao de busca diferente e nao repetir o mesmo angulo dos outros.
- Nao coloque fontes consultadas.
- Nao coloque slug.
- Antes de responder, revise sua propria saida e corrija acentos, remova travessoes longos, confira o HTML e garanta que nenhum fato especifico foi inventado.
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error?.message || `Erro ao revisar o post ${index}.`;
        throw new Error(message);
    }

    const polishedContent = data?.choices?.[0]?.message?.content?.trim();
    if (!polishedContent) throw new Error(`A revisao respondeu vazia no post ${index}.`);
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error?.message || 'Erro ao chamar a DeepSeek.';
        throw new Error(message);
    }

    const choice = data?.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
        const reason = choice?.finish_reason ? ` Motivo: ${choice.finish_reason}.` : '';
        throw new Error(`A DeepSeek respondeu vazio no post ${index}.${reason}`);
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

        const results = await Promise.allSettled(postRequests);
        const failedResult = results.find(result => result.status === 'rejected');
        if (failedResult) throw failedResult.reason;

        const posts = results.map(result => result.value);

        return sendJson(response, 200, { content: posts.join('\n\n\n') });
    } catch (error) {
        return sendJson(response, 502, { error: error.message || 'Erro ao gerar posts.' });
    }
};
