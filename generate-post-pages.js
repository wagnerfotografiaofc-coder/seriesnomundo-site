const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://www.seriesnomundo.site';
const publicScript = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const SUPABASE_URL = publicScript.match(/SUPABASE_URL = '([^']+)'/)?.[1];
const SUPABASE_ANON_KEY = publicScript.match(/SUPABASE_ANON_KEY = '([^']+)'/)?.[1];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Nao foi possivel ler as chaves publicas do Supabase em script.js.');
}

const CORE_SITEMAP_PAGES = [
    { loc: '/', priority: '1.0' },
    { loc: '/filmes', priority: '0.8' },
    { loc: '/series', priority: '0.8' },
    { loc: '/quizzes', priority: '0.8' },
    { loc: '/sobre', priority: '0.5' },
    { loc: '/privacidade', priority: '0.4' },
    { loc: '/aviso-legal', priority: '0.4' },
    // Redes sociais guardadas para reativar quando os perfis oficiais estiverem prontos.
];

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function slugify(value) {
    const slug = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug.slice(0, 90).replace(/-+$/g, '') || 'post';
}

function getPostPath(post) {
    return `posts/${slugify(post.title)}`;
}

function getPostFilePath(post) {
    return `${getPostPath(post)}/index.html`;
}

function getPostUrl(post, prefix = '') {
    return `${prefix}${getPostPath(post)}`;
}

function getImagePath(post, prefix = '') {
    if (post.image_url) {
        if (/^https?:\/\//i.test(post.image_url)) return post.image_url;
        return `${prefix}${post.image_url.replace(/^\//, '')}`;
    }

    return `${prefix}${post.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png'}`;
}

function renderCard(item, type) {
    const isPost = type === 'post';
    const imagePath = isPost ? getImagePath(item) : (item.image_url || 'imagens/2.png');
    const link = isPost ? getPostUrl(item) : `/quiz/${item.id}`;
    const buttonText = isPost ? 'Ler Mais' : 'Jogar Agora';

    return `                <div class="card">
                    <a href="${link}" class="card-link-wrapper">
                        <img src="${imagePath}" alt="${escapeHTML(item.title)}" class="card-image">
                        <div class="card-content">
                            <h3 class="card-title">${escapeHTML(item.title)}</h3>
                            <p class="card-description">${escapeHTML(item.description)}</p>
                            <span class="card-button">${buttonText}</span>
                        </div>
                    </a>
                </div>`;
}

function renderCardGrid(items, type) {
    if (!items.length) return '<p>Nenhum item encontrado.</p>';
    return `\n${items.map(item => renderCard(item, type)).join('\n')}\n        `;
}

function renderJsonLd(data) {
    return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function getOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Series No Mundo',
        url: SITE_URL,
        logo: `${SITE_URL}/imagens/sofa.png`,
        sameAs: ['https://www.instagram.com/series_no_mundo']
    };
}

function getWebsiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Series No Mundo',
        url: SITE_URL,
        description: 'Noticias, listas, teorias, curiosidades e quizzes sobre filmes, series, animes e cultura pop.',
        publisher: {
            '@type': 'Organization',
            name: 'Series No Mundo'
        }
    };
}

function getArticleSchema(post) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        image: getAbsoluteImageUrl(post),
        url: `${SITE_URL}/${getPostPath(post)}`,
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/${getPostPath(post)}`
        },
        datePublished: post.created_at || undefined,
        dateModified: post.updated_at || post.created_at || undefined,
        author: {
            '@type': 'Organization',
            name: 'Series No Mundo'
        },
        publisher: {
            '@type': 'Organization',
            name: 'Series No Mundo',
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/imagens/sofa.png`
            }
        }
    };
}

function getBreadcrumbSchema(post) {
    const categoryName = post.category === 'filme' ? 'Filmes' : 'Séries';
    const categoryUrl = post.category === 'filme' ? `${SITE_URL}/filmes` : `${SITE_URL}/series`;

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Início',
                item: `${SITE_URL}/`
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: categoryName,
                item: categoryUrl
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: post.title,
                item: `${SITE_URL}/${getPostPath(post)}`
            }
        ]
    };
}

function replaceGridContent(html, gridId, content) {
    const startTag = `<div class="card-grid" id="${gridId}">`;
    const startIndex = html.indexOf(startTag);
    if (startIndex === -1) return html;

    let searchIndex = startIndex + startTag.length;
    let depth = 1;

    while (depth > 0) {
        const nextOpen = html.indexOf('<div', searchIndex);
        const nextClose = html.indexOf('</div>', searchIndex);

        if (nextClose === -1) return html;
        if (nextOpen !== -1 && nextOpen < nextClose) {
            depth += 1;
            searchIndex = nextOpen + 4;
        } else {
            depth -= 1;
            searchIndex = nextClose + 6;
        }
    }

    return `${html.slice(0, startIndex + startTag.length)}${content}${html.slice(searchIndex - 6)}`;
}

function upsertHomeSchema(html) {
    const schemaHtml = `    ${renderJsonLd(getOrganizationSchema())}
    ${renderJsonLd(getWebsiteSchema())}`;
    const schemaPattern = /\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\s*\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/;

    if (schemaPattern.test(html)) {
        return html.replace(schemaPattern, `\n${schemaHtml}`);
    }

    return html.replace('</head>', `${schemaHtml}\n</head>`);
}

function updateGridPage(fileName, gridId, items, type) {
    const pagePath = path.join(__dirname, fileName);
    let html = fs.readFileSync(pagePath, 'utf8');
    html = replaceGridContent(html, gridId, renderCardGrid(items, type));
    fs.writeFileSync(pagePath, html, 'utf8');
}

function getAbsoluteImageUrl(post) {
    const imagePath = getImagePath(post);
    return /^https?:\/\//i.test(imagePath) ? imagePath : `${SITE_URL}/${imagePath}`;
}

function getTagVariants(tags) {
    const variants = new Set();
    (Array.isArray(tags) ? tags : []).forEach(tag => {
        const cleanTag = String(tag || '').trim();
        if (!cleanTag) return;
        const lowerTag = cleanTag.toLowerCase();
        const titleTag = lowerTag.replace(/\b\w/g, letter => letter.toUpperCase());
        variants.add(cleanTag);
        variants.add(lowerTag);
        variants.add(titleTag);
    });
    return [...variants];
}

function getYouTubeEmbedUrl(videoUrl) {
    if (!videoUrl) return '';

    try {
        const url = new URL(videoUrl);
        const hostname = url.hostname.replace(/^www\./, '');
        let videoId = '';

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
            else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2] || '';
            else if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/')[2] || '';
        } else if (hostname === 'youtu.be') {
            videoId = url.pathname.split('/')[1] || '';
        }

        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return '';
        return `https://www.youtube.com/embed/${videoId}`;
    } catch (error) {
        return '';
    }
}

function normalizePostContent(content) {
    let html = String(content || '').trim();
    html = html.replace(/<!doctype[^>]*>/gi, '');
    html = html.replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '');
    html = html.replace(/<head[\s\S]*?<\/head>/gi, '');
    html = html.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');
    return html.trim();
}

async function fetchSupabase(pathname) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error(`Erro ao buscar ${pathname}: ${response.status} ${await response.text()}`);
    }

    return response.json();
}

function getSuggestions(post, posts) {
    const relatedTags = getTagVariants(post.tags).map(tag => tag.toLowerCase());
    let suggestions = [];

    if (relatedTags.length > 0) {
        suggestions = posts.filter(candidate => {
            if (candidate.id === post.id) return false;
            const candidateTags = getTagVariants(candidate.tags).map(tag => tag.toLowerCase());
            return candidateTags.some(tag => relatedTags.includes(tag));
        });
    }

    if (suggestions.length === 0) {
        suggestions = posts.filter(candidate => candidate.id !== post.id && candidate.category === post.category);
    }

    return suggestions
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 3);
}

function renderSuggestions(suggestions) {
    if (!suggestions.length) return '';

    const links = suggestions.map(post => `
                <a href="/${getPostPath(post)}" class="suggestion-button">
                    <h4>${escapeHTML(post.title)}</h4>
                    <p>${escapeHTML(post.description)}</p>
                </a>`).join('');

    return `
        <div id="read-also-section">
            <h2 class="section-title">Leia Também</h2>
            <div class="suggestions-grid" id="suggestions-grid">${links}
            </div>
        </div>`;
}

function renderPostPage(post, suggestions) {
    const postPath = getPostPath(post);
    const canonicalUrl = `${SITE_URL}/${postPath}`;
    const imagePath = getImagePath(post, '/');
    const imageUrl = getAbsoluteImageUrl(post);
    const videoEmbedUrl = getYouTubeEmbedUrl(post.video_url);
    const videoHtml = videoEmbedUrl ? `
            <div class="post-video-wrapper">
                <iframe src="${videoEmbedUrl}" title="Trailer oficial de ${escapeHTML(post.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
            </div>` : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(post.title)} | Series No Mundo</title>
    <meta name="description" content="${escapeHTML(post.description)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Series No Mundo">
    <meta property="og:title" content="${escapeHTML(post.title)} | Series No Mundo">
    <meta property="og:description" content="${escapeHTML(post.description)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${imageUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHTML(post.title)} | Series No Mundo">
    <meta name="twitter:description" content="${escapeHTML(post.description)}">
    <meta name="twitter:image" content="${imageUrl}">
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/png" href="/imagens/sofa.png">
    ${renderJsonLd(getArticleSchema(post))}
    ${renderJsonLd(getBreadcrumbSchema(post))}
</head>
<body data-theme="dark">

    <header class="container">
        <div class="menu-icon">☰</div>
        <div class="logo"><a href="/" style="color: inherit; text-decoration: none;">SÉRIES NO MUNDO</a></div>
        <div id="theme-switcher">
            <div class="theme-dot" data-theme="dark" style="background-color: #121213;"></div>
            <div class="theme-dot" data-theme="light" style="background-color: #f8f9fa;"></div>
            <div class="theme-dot" data-theme="red" style="background-color: #2b0a0a;"></div>
        </div>
    </header>

    <div class="side-menu">
        <nav>
            <ul>
                <li><a href="/">Início</a></li>
                <li><a href="/filmes">Filmes</a></li>
                <li><a href="/series">Séries</a></li>
                <li><a href="/quizzes">Quizzes</a></li>
            </ul>
        </nav>
    </div>

    <main class="container">
        <article id="post-container" class="text-page">
            <a class="card-button back-button" href="${post.category === 'filme' ? '/filmes' : '/series'}" style="margin-bottom: 30px;">&lt; Voltar</a>
            <h1 class="text-page-title">${escapeHTML(post.title)}</h1>
            <img src="${imagePath}" alt="${escapeHTML(post.title)}" class="text-page-image">
            <div class="text-page-content">${normalizePostContent(post.content)}</div>${videoHtml}
        </article>
${renderSuggestions(suggestions)}
    </main>
    
    <footer>
        <div class="container footer-container">
            <div class="footer-links">
                <a href="/sobre">Sobre Nós</a>
                <a href="/privacidade">Política de Privacidade</a>
                <a href="/aviso-legal">Aviso Legal</a>
            </div>
            <div class="footer-social">
                <a href="https://www.instagram.com/series_no_mundo" target="_blank" class="social-button instagram">Instagram</a>
            </div>
        </div>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/script.js"></script>
</body>
</html>
`;
}

function renderSitemap(posts) {
    const staticPages = CORE_SITEMAP_PAGES.map(page => `  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <priority>${page.priority}</priority>
  </url>`);

    const postPages = posts.map(post => `  <url>
    <loc>${SITE_URL}/${getPostPath(post)}</loc>
    <priority>0.7</priority>
  </url>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticPages, ...postPages].join('\n')}
</urlset>
`;
}

async function main() {
    const posts = await fetchSupabase('posts?select=*&order=created_at.desc');
    const quizzes = await fetchSupabase('quizzes?select=*&order=created_at.desc');
    const postsDir = path.join(__dirname, 'posts');
    fs.rmSync(postsDir, { recursive: true, force: true });
    fs.mkdirSync(postsDir, { recursive: true });

    for (const post of posts) {
        const suggestions = getSuggestions(post, posts);
        const html = renderPostPage(post, suggestions);
        const outputPath = path.join(__dirname, getPostFilePath(post));
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, html, 'utf8');
    }

    fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), renderSitemap(posts), 'utf8');
    const indexPath = path.join(__dirname, 'index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    const featuredFilmes = posts.filter(post => post.category === 'filme' && post.is_featured).slice(0, 3);
    const featuredSeries = posts.filter(post => post.category === 'serie' && post.is_featured).slice(0, 3);
    const featuredQuizzes = quizzes.filter(quiz => quiz.is_featured).slice(0, 3);
    indexHtml = replaceGridContent(indexHtml, 'filmes-destaque-grid', renderCardGrid(featuredFilmes.length ? featuredFilmes : posts.filter(post => post.category === 'filme').slice(0, 3), 'post'));
    indexHtml = replaceGridContent(indexHtml, 'series-destaque-grid', renderCardGrid(featuredSeries.length ? featuredSeries : posts.filter(post => post.category === 'serie').slice(0, 3), 'post'));
    indexHtml = replaceGridContent(indexHtml, 'quiz-destaque-grid', renderCardGrid(featuredQuizzes.length ? featuredQuizzes : quizzes.slice(0, 3), 'quiz'));
    indexHtml = upsertHomeSchema(indexHtml);
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    updateGridPage('filmes.html', 'posts-grid-container', posts.filter(post => post.category === 'filme').slice(0, 12), 'post');
    updateGridPage('series.html', 'posts-grid-container', posts.filter(post => post.category === 'serie').slice(0, 12), 'post');
    updateGridPage('quizzes.html', 'quizzes-grid-container', quizzes.slice(0, 12), 'quiz');
    console.log(`Geradas ${posts.length} paginas em posts/ e sitemap.xml atualizado.`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
