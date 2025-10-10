// Suas chaves do Supabase
const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const pagePath = window.location.pathname.split("/").pop() || "index.html";

    function renderCardGrid(containerId, items, type) {
        const gridContainer = document.getElementById(containerId);
        if (!gridContainer) return;

        gridContainer.innerHTML = '';
        if (!items || items.length === 0) {
            gridContainer.innerHTML = `<p style="grid-column: 1 / -1;">Nenhum item encontrado.</p>`;
            return;
        }

        items.forEach(item => {
            const isPost = type === 'post';
            const imagePath = item.image_url || (isPost ? (item.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png') : 'imagens/2.png');
            const link = isPost ? `post.html?id=${item.id}` : `play-quiz.html?id=${item.id}`;
            
            gridContainer.innerHTML += `
                <div class="card">
                    <a href="${link}" class="card-link-wrapper">
                        <img src="${imagePath}" alt="${item.title}" class="card-image">
                        <div class="card-content">
                            <h3 class="card-title">${item.title}</h3>
                            <p class="card-description">${item.description}</p>
                        </div>
                    </a>
                </div>`;
        });
    }

    function renderPagination(containerId, page, pageCount, category) {
        const paginationContainer = document.getElementById(containerId);
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        for (let i = 1; i <= pageCount; i++) {
            paginationContainer.innerHTML += `<button class="page-button ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        document.querySelectorAll('.page-button').forEach(button => {
            button.addEventListener('click', () => {
                loadPostsPage(category, parseInt(button.dataset.page));
            });
        });
    }

    async function loadHomePage() {
        const { data: featuredFilmes } = await supabaseClient.from('posts').select('*').eq('category', 'filme').eq('is_featured', true).limit(3);
        const { data: featuredSeries } = await supabaseClient.from('posts').select('*').eq('category', 'serie').eq('is_featured', true).limit(3);
        const { data: featuredQuiz } = await supabaseClient.from('quizzes').select('*').eq('is_featured', true).limit(1);

        renderCardGrid('filmes-destaque-grid', featuredFilmes, 'post');
        renderCardGrid('series-destaque-grid', featuredSeries, 'post');
        if(featuredQuiz) renderCardGrid('quiz-destaque-grid', featuredQuiz, 'quiz');
    }

    async function loadPostsPage(category, page = 1) {
        const postsPerPage = 9;
        const startIndex = (page - 1) * postsPerPage;
        const searchTerm = document.getElementById('search-input')?.value || '';
        let query = supabaseClient.from('posts').select('*', { count: 'exact' }).eq('category', category).order('created_at', { ascending: false }).range(startIndex, startIndex + postsPerPage - 1);
        if (searchTerm) { query = query.ilike('title', `%${searchTerm}%`); }
        const { data, error, count } = await query;
        if (error) { console.error("Erro:", error); } else {
            renderCardGrid('posts-grid-container', data, 'post');
            const pageCount = Math.ceil(count / postsPerPage);
            renderPagination('pagination-controls', page, pageCount, category);
        }
    }

    async function loadQuizzesPage() {
        const { data, error } = await supabaseClient.from('quizzes').select('*').order('created_at', { ascending: false });
        if (error) { console.error("Erro:", error); }
        else { renderCardGrid('quizzes-grid-container', data, 'quiz'); }
    }

    async function loadSinglePostPage() {
        const postId = new URLSearchParams(window.location.search).get('id');
        if (!postId) { document.body.innerHTML = '<h1>Post não encontrado.</h1>'; return; }
        const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
        if (error) { document.body.innerHTML = '<h1>Erro ao carregar o post.</h1>'; }
        else {
            document.title = `${post.title} - SERIES NO MUNDO`;
            const imagePath = post.image_url || (post.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png');
            document.getElementById('post-container').innerHTML = `
                <h1 class="text-page-title">${post.title}</h1>
                <img src="${imagePath}" alt="${post.title}" class="text-page-image">
                <div class="text-page-content">${post.content}</div>

            `;
        }
    }

    if (pagePath === 'index.html' || pagePath === '') { loadHomePage(); }
    else if (pagePath === 'filmes.html') { loadPostsPage('filme'); document.getElementById('search-input').addEventListener('input', () => loadPostsPage('filme')); }
    else if (pagePath === 'series.html') { loadPostsPage('serie'); document.getElementById('search-input').addEventListener('input', () => loadPostsPage('serie')); }
    else if (pagePath === 'post.html') { loadSinglePostPage(); }
    else if (pagePath === 'quizzes.html') { loadQuizzesPage(); }

    const menuIcon = document.querySelector('.menu-icon');
    const sideMenu = document.querySelector('.side-menu');
    if (menuIcon) { menuIcon.addEventListener('click', () => sideMenu.classList.toggle('open')); }
    document.addEventListener('click', (event) => {
        if (sideMenu && sideMenu.classList.contains('open') && !sideMenu.contains(event.target) && !menuIcon.contains(event.target)) {
            sideMenu.classList.remove('open');
        }
    });
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => { document.body.dataset.theme = dot.dataset.theme; });
    });
});