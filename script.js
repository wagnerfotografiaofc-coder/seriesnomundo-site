// Suas chaves do Supabase
const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) { document.body.dataset.theme = savedTheme; }
}
applySavedTheme();

document.addEventListener('DOMContentLoaded', () => {
    const pagePath = window.location.pathname.split("/").pop() || "index.html";
    const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
    optimizeStaticImages();
    const quizBackButton = document.getElementById('quiz-back-button');
    if (quizBackButton) {
        quizBackButton.addEventListener('click', () => { history.back(); });
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function slugify(value) {
        const slug = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const limitedSlug = slug.length > 90 ? slug.slice(0, 90).replace(/-[a-z0-9]*$/g, '') : slug;
        return limitedSlug.replace(/(?:-(?:a|as|com|da|das|de|do|dos|e|em|na|nas|no|nos|o|os|para|por))+$/g, '').replace(/-+$/g, '') || 'post';
    }

    function getPostPagePath(post) {
        return `/posts/${slugify(post.title)}`;
    }

    function getQuizPagePath(quiz) {
        return `/quiz/${quiz.id}`;
    }

    function getImagePathForPage(imagePath) {
        if (!imagePath || /^https?:\/\//i.test(imagePath)) return imagePath;
        return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    }

    function cleanPostContent(content) {
        return String(content || '').replace(/\s*:contentReference\[[^\]]+\]\{[^}]+\}/g, '');
    }

    function optimizeStaticImages() {
        const images = [...document.querySelectorAll('img')];
        images.forEach((img, index) => {
            if (!img.hasAttribute('loading')) img.setAttribute('loading', index < 2 ? 'eager' : 'lazy');
            if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
            if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', index === 0 ? 'high' : 'auto');
        });
    }

    function renderCardGrid(containerId, items, type) {
        const gridContainer = document.getElementById(containerId);
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        if (!items || items.length === 0) {
            gridContainer.innerHTML = `<p style="grid-column: 1 / -1;">Nenhum item encontrado.</p>`;
            return;
        }
        items.forEach((item, index) => {
            const isPost = type === 'post';
            const imagePath = item.image_url || (isPost ? (item.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png') : 'imagens/2.png');
            const link = isPost ? getPostPagePath(item) : getQuizPagePath(item);
            const imageLoading = index < 3 ? 'eager' : 'lazy';
            const imageFetchPriority = index === 0 ? 'high' : 'auto';
            gridContainer.innerHTML += `
                <div class="card">
                    <a href="${link}" class="card-link-wrapper">
                        <img src="${imagePath}" alt="${item.title}" class="card-image" loading="${imageLoading}" decoding="async" fetchpriority="${imageFetchPriority}">
                        <div class="card-content">
                            <h3 class="card-title">${item.title}</h3>
                            <p class="card-description">${item.description}</p>
                            <span class="card-button">${isPost ? 'Ler Mais' : 'Jogar Agora'}</span>
                        </div>
                    </a>
                </div>`;
        });
    }

    function renderSuggestions(containerId, posts) {
        const gridContainer = document.getElementById(containerId);
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        posts.forEach(post => {
            gridContainer.innerHTML += `
                <a href="${getPostPagePath(post)}" class="suggestion-button">
                    <h4>${post.title}</h4>
                    <p>${post.description}</p>
                </a>
            `;
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

    function updateMetaTag(attribute, key, content) {
        let tag = document.querySelector(`meta[${attribute}="${key}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute(attribute, key);
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', content || '');
    }

    function updatePageMeta({ title, description, url, image, type = 'website' }) {
        const finalTitle = title || 'Series No Mundo';
        const finalDescription = description || 'Noticias, listas, curiosidades, teorias e quizzes sobre filmes, series, animes e cultura pop.';
        const finalUrl = url || window.location.href;
        const finalImage = image || `${window.location.origin}/imagens/sofa.png`;

        document.title = finalTitle;
        updateMetaTag('name', 'description', finalDescription);
        updateMetaTag('property', 'og:type', type);
        updateMetaTag('property', 'og:title', finalTitle);
        updateMetaTag('property', 'og:description', finalDescription);
        updateMetaTag('property', 'og:url', finalUrl);
        updateMetaTag('property', 'og:image', finalImage);
        updateMetaTag('name', 'twitter:title', finalTitle);
        updateMetaTag('name', 'twitter:description', finalDescription);
        updateMetaTag('name', 'twitter:image', finalImage);

        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', finalUrl);
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

    // --- FUNÇÕES DE CARREGAMENTO DE PÁGINA ---
    async function loadHomePage() {
        const postListFields = 'id,title,description,image_url,category';
        const quizListFields = 'id,title,description,image_url';
        const { data: featuredFilmes } = await supabaseClient.from('posts').select(postListFields).eq('category', 'filme').eq('is_featured', true).limit(3);
        const { data: featuredSeries } = await supabaseClient.from('posts').select(postListFields).eq('category', 'serie').eq('is_featured', true).limit(3);
        const { data: featuredQuiz } = await supabaseClient.from('quizzes').select(quizListFields).eq('is_featured', true).limit(3);
        renderCardGrid('filmes-destaque-grid', featuredFilmes, 'post');
        renderCardGrid('series-destaque-grid', featuredSeries, 'post');
        if (featuredQuiz && featuredQuiz.length > 0) { renderCardGrid('quiz-destaque-grid', featuredQuiz, 'quiz'); }
    }

    async function loadPostsPage(category, page = 1) {
        const postsPerPage = 9;
        const startIndex = (page - 1) * postsPerPage;
        const searchTerm = document.getElementById('search-input')?.value || '';
        let query = supabaseClient.from('posts').select('id,title,description,image_url,category', { count: 'exact' }).eq('category', category).order('created_at', { ascending: false }).range(startIndex, startIndex + postsPerPage - 1);
        if (searchTerm) { query = query.ilike('title', `%${searchTerm}%`); }
        const { data, error, count } = await query;
        if (error) { console.error("Erro:", error); } else {
            renderCardGrid('posts-grid-container', data, 'post');
            const pageCount = Math.ceil(count / postsPerPage);
            renderPagination('pagination-controls', page, pageCount, category);
        }
    }

    async function loadQuizzesPage() {
        const { data, error } = await supabaseClient.from('quizzes').select('id,title,description,image_url').order('created_at', { ascending: false });
        if (error) { console.error("Erro ao buscar quizzes:", error); }
        else { renderCardGrid('quizzes-grid-container', data, 'quiz'); }
    }

    async function loadSinglePostPage() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    const slugFromPath = cleanPath.startsWith('/posts/') ? cleanPath.split('/').filter(Boolean).pop().replace(/\.html$/i, '') : '';
    const legacyPostId = slugFromPath.match(/^(\d+)-/)?.[1] || '';
    let post = null;
    let error = null;

    if (postId || legacyPostId) {
        const result = await supabaseClient.from('posts').select('*').eq('id', postId || legacyPostId).single();
        post = result.data;
        error = result.error;
    } else if (slugFromPath) {
        const result = await supabaseClient.from('posts').select('*');
        error = result.error;
        post = (result.data || []).find(candidate => slugify(candidate.title) === slugFromPath);
    }

    if (!postId && !slugFromPath) { document.body.innerHTML = '<h1>Post não encontrado.</h1>'; return; }
    if (error) { document.body.innerHTML = '<h1>Erro ao carregar o post.</h1>'; return; }
    if (!post) { document.body.innerHTML = '<h1>Post não encontrado.</h1>'; return; }

    const imagePath = getImagePathForPage(post.image_url || (post.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png'));
    updatePageMeta({
        title: `${post.title} | Series No Mundo`,
        description: post.description,
        url: `${window.location.origin}${getPostPagePath(post)}`,
        image: new URL(imagePath, window.location.origin).href,
        type: 'article'
    });
    const videoEmbedUrl = getYouTubeEmbedUrl(post.video_url);
    const videoHtml = videoEmbedUrl ? `<div class="post-video-wrapper"><iframe src="${videoEmbedUrl}" title="Trailer oficial de ${post.title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : '';
    document.getElementById('post-container').innerHTML = `<button class="card-button back-button" id="back-button" style="margin-bottom: 30px;">&lt; Voltar</button><h1 class="text-page-title">${post.title}</h1><img src="${imagePath}" alt="${post.title}" class="text-page-image" loading="eager" decoding="async" fetchpriority="high"><div class="text-page-content">${cleanPostContent(post.content)}</div>${videoHtml}`;
    document.getElementById('back-button').addEventListener('click', () => { history.back(); });

    // 2. Lógica de Sugestão por Tags (a parte nova e correta)
    let suggestions = [];
    // Primeiro, tenta buscar por tags
    if (post.tags && post.tags.length > 0) {
        const relatedTags = getTagVariants(post.tags);
        const { data: tagSuggestions } = await supabaseClient
            .from('posts')
            .select('id,title,description')
            .overlaps('tags', relatedTags) // Busca posts que tenham pelo menos uma tag em comum
            .neq('id', post.id)          // Garante que não vai sugerir o próprio post
            .order('created_at', { ascending: false })
            .limit(3);
        suggestions = tagSuggestions;
    }

    // Se não encontrou sugestões por tag (ou o post não tem tags), usa a busca por categoria como um PLANO B.
    if (!suggestions || suggestions.length === 0) {
        const { data: categorySuggestions } = await supabaseClient
            .from('posts')
            .select('id,title,description')
            .eq('category', post.category)
            .neq('id', post.id)
            .limit(3)
            .order('created_at', { ascending: false });
        suggestions = categorySuggestions;
    }

    // 3. Mostra as sugestões na tela
    if (suggestions && suggestions.length > 0) {
        renderSuggestions('suggestions-grid', suggestions);
        document.getElementById('read-also-section').classList.remove('hidden');
    } else {
        document.getElementById('read-also-section').classList.add('hidden');
    }
}
    
    async function loadQuizPlayer() {
        const quizId = new URLSearchParams(window.location.search).get('id') || (cleanPath.startsWith('/quiz/') ? cleanPath.split('/').filter(Boolean).pop() : '');
        const container = document.getElementById('quiz-player-container');
        if (!quizId) { container.innerHTML = '<h1>Quiz não encontrado.</h1>'; return; }
        const { data: quiz, error } = await supabaseClient.from('quizzes').select('id,title,description,quiz_type,items_per_round').eq('id', quizId).single();
        if (error) { container.innerHTML = '<h1>Erro ao carregar o quiz.</h1>'; return; }
        updatePageMeta({
            title: `${quiz.title} | Quiz Series No Mundo`,
            description: quiz.description,
            url: quizId ? `${window.location.origin}/quiz/${quizId}` : window.location.href,
            image: `${window.location.origin}/imagens/sofa.png`
        });
        switch (quiz.quiz_type) {
            case 'true_false': await playTrueFalseQuiz(quiz); break;
            case 'trivia': case 'who_am_i': await playTriviaQuiz(quiz); break;
            case 'association': await playAssociationQuiz(quiz); break;
            case 'personality': await playPersonalityQuiz(quiz); break;
            default: container.innerHTML = `<h1>O motor para o quiz tipo "${quiz.quiz_type}" ainda está em construção!</h1>`;
        }
    }

    async function playTrueFalseQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('id,question_text,is_true').eq('quiz_id', quiz.id).order('id');
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas.</h1>'; return; }
        let currentQuestionIndex = 0; let score = 0; const container = document.getElementById('quiz-player-container');
        function renderQuestion() {
            const question = questions[currentQuestionIndex];
            const progress = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
            container.innerHTML = `<div class="quiz-container-player true-false-player"><div class="quiz-progress-wrap"><div class="quiz-progress-meta"><span>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</span><strong>${score} acertos</strong></div><div class="quiz-progress-track"><span style="width: ${progress}%"></span></div></div><h2 class="text-page-title tf-question">${question.question_text}</h2><div class="tf-options"><button class="tf-btn tf-true" data-answer="true"><span class="tf-symbol">V</span><span>Verdadeiro</span></button><button class="tf-btn tf-false" data-answer="false"><span class="tf-symbol">F</span><span>Falso</span></button></div></div>`;
            document.querySelectorAll('.tf-btn').forEach(button => button.addEventListener('click', handleAnswer));
        }
        function handleAnswer(e) { const selectedButton = e.currentTarget; const userAnswer = selectedButton.dataset.answer === 'true'; const correctAnswer = questions[currentQuestionIndex].is_true; document.querySelectorAll('.tf-btn').forEach(btn => btn.disabled = true); if (userAnswer === correctAnswer) { selectedButton.classList.add('correct'); score++; } else { selectedButton.classList.add('incorrect'); const correctButton = document.querySelector(`.tf-btn[data-answer="${correctAnswer}"]`); if (correctButton) { correctButton.classList.add('correct'); } } setTimeout(nextStep, 1200); }
        function nextStep() { currentQuestionIndex++; if (currentQuestionIndex < questions.length) { renderQuestion(); } else { renderFinalResult(); } }
        function renderFinalResult() { let message = ""; const percentage = (score / questions.length) * 100; if (percentage <= 30) message = "Hmm, precisa estudar mais, hein?"; else if (percentage <= 70) message = "Bom trabalho!"; else if (percentage < 100) message = "Excelente!"; else message = "PERFEITO!"; container.innerHTML = `<div class="quiz-container-player true-false-player true-false-result"><p class="quiz-result-kicker">Quiz finalizado</p><h2>${message}</h2><p id="result-score">${score}/${questions.length}</p><p>Você acertou ${score} de ${questions.length} perguntas.</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`; container.querySelector('#restart-button').addEventListener('click', startQuiz); }
        function startQuiz() { currentQuestionIndex = 0; score = 0; renderQuestion(); }
        startQuiz();
    }

    async function playTriviaQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('id,question_text,answers(answer_text,is_correct)').eq('quiz_id', quiz.id);
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas deste quiz.</h1>'; return; }
        let currentQuestionIndex = 0; let score = 0; const container = document.getElementById('quiz-player-container');
        const isWhoAmI = quiz.quiz_type === 'who_am_i';
        function renderQuestion() {
            const question = questions[currentQuestionIndex];
            let answersHTML = '';
            const shuffledAnswers = question.answers.sort(() => Math.random() - 0.5);
            shuffledAnswers.forEach((answer, index) => {
                if (isWhoAmI) answersHTML += `<button class="answer-btn whoami-btn" data-correct="${answer.is_correct}"><span class="whoami-letter">${String.fromCharCode(65 + index)}</span><span>${answer.answer_text}</span></button>`;
                else answersHTML += `<button class="answer-btn" data-correct="${answer.is_correct}">${answer.answer_text}</button>`;
            });
            if (isWhoAmI) {
                const progress = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
                container.innerHTML = `<div class="quiz-container-player whoami-player"><div class="quiz-progress-wrap"><div class="quiz-progress-meta"><span>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</span><strong>${score} acertos</strong></div><div class="quiz-progress-track"><span style="width: ${progress}%"></span></div></div><p class="quiz-mode-kicker">Quem sou eu?</p><h2 class="text-page-title whoami-question">${question.question_text}</h2><div class="answer-options whoami-options">${answersHTML}</div><button id="next-button" class="card-button hidden" style="margin-top: 26px;">Próxima Pergunta</button></div>`;
            } else {
                container.innerHTML = `<div class="quiz-container-player"><p>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</p><h2 class="text-page-title">${question.question_text}</h2><div class="answer-options">${answersHTML}</div><button id="next-button" class="card-button hidden" style="margin-top: 20px;">Próxima Pergunta</button></div>`;
            }
            document.querySelectorAll('.answer-btn').forEach(button => button.addEventListener('click', handleAnswer));
        }
        function handleAnswer(e) {
            const selectedButton = e.currentTarget; const isCorrect = selectedButton.dataset.correct === 'true';
            document.querySelectorAll('.answer-btn').forEach(btn => { btn.disabled = true; if (btn.dataset.correct === 'true') { btn.classList.add('correct'); } });
            if (!isCorrect) { selectedButton.classList.add('incorrect'); } else { score++; }
            if (currentQuestionIndex < questions.length - 1) { const nextButton = document.getElementById('next-button'); nextButton.classList.remove('hidden'); nextButton.addEventListener('click', nextStep, { once: true });
            } else { setTimeout(renderFinalResult, 1500); }
        }
        function nextStep() { currentQuestionIndex++; renderQuestion(); }
        function renderFinalResult() { let message = ""; const percentage = (score / questions.length) * 100; if (percentage <= 30) message = "Hmm, precisa estudar mais, hein?"; else if (percentage <= 70) message = "Bom trabalho!"; else if (percentage < 100) message = "Excelente!"; else message = "PERFEITO!"; if (isWhoAmI) container.innerHTML = `<div class="quiz-container-player whoami-player quiz-mode-result"><p class="quiz-result-kicker">Quiz finalizado</p><h2>${message}</h2><p id="result-score">${score}/${questions.length}</p><p>Você acertou ${score} de ${questions.length} perguntas.</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`; else container.innerHTML = `<div class="quiz-container-player"><h2>Quiz Finalizado!</h2><p id="result-score">Você acertou ${score} de ${questions.length}!</p><p>${message}</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`; container.querySelector('#restart-button').addEventListener('click', startQuiz); }
        function startQuiz() { currentQuestionIndex = 0; score = 0; renderQuestion(); }
        startQuiz();
    }

    async function playPersonalityQuiz(quiz) {
        const { data: questions, error } = await supabaseClient
            .from('questions')
            .select('id,question_text,answers(answer_text,points_to)')
            .eq('quiz_id', quiz.id)
            .order('id');
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas deste quiz.</h1>'; return; }

        let currentQuestionIndex = 0; const scores = {}; const container = document.getElementById('quiz-player-container');
        function renderQuestion() {
            const question = questions[currentQuestionIndex];
            const answers = (question.answers || []).filter(answer => answer.answer_text && answer.points_to);
            if (answers.length === 0) { nextStep(); return; }
            const answersHTML = answers.map(answer => `<button class="answer-btn personality-btn" data-result="${answer.points_to}">${answer.answer_text}</button>`).join('');
            container.innerHTML = `<div class="quiz-container-player personality-player"><p>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</p><h2 class="text-page-title">${question.question_text}</h2><div class="answer-options">${answersHTML}</div></div>`;
            document.querySelectorAll('.personality-btn').forEach(button => button.addEventListener('click', handleAnswer));
        }
        function handleAnswer(e) {
            const result = e.currentTarget.dataset.result;
            scores[result] = (scores[result] || 0) + 1;
            e.currentTarget.classList.add('selected-answer');
            document.querySelectorAll('.personality-btn').forEach(btn => btn.disabled = true);
            setTimeout(nextStep, 350);
        }
        function nextStep() {
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) renderQuestion();
            else renderFinalResult();
        }
        function renderFinalResult() {
            const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const resultName = entries[0]?.[0] || 'Resultado indefinido';
            const resultScore = entries[0]?.[1] || 0;
            const percentage = Math.round((resultScore / questions.length) * 100);
            container.innerHTML = `<div class="quiz-container-player personality-player result-card"><p>Seu resultado</p><h2 class="text-page-title">${resultName}</h2><p id="result-score">${percentage}%</p><p>Esse foi o perfil que mais combinou com suas respostas.</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`;
            container.querySelector('#restart-button').addEventListener('click', startQuiz);
        }
        function startQuiz() {
            currentQuestionIndex = 0;
            Object.keys(scores).forEach(key => delete scores[key]);
            renderQuestion();
        }
        startQuiz();
    }

    async function playAssociationQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('id,question_text,answers(answer_text)').eq('quiz_id', quiz.id).order('id');
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas deste quiz.</h1>'; return; }
        
        let totalScore = 0; const itemsPerRound = Math.max(1, parseInt(quiz.items_per_round, 10) || 6); const totalRounds = Math.ceil(questions.length / itemsPerRound); let currentRound = 1; const container = document.getElementById('quiz-player-container');
        function renderRound(roundNum) {
            const startIndex = (roundNum - 1) * itemsPerRound; const roundQuestions = questions.slice(startIndex, startIndex + itemsPerRound);
            if (roundQuestions.length === 0) { renderFinalResult(); return; }
            const items = roundQuestions
                .filter(q => q.answers && q.answers.length > 0)
                .map(q => ({ id: String(q.id), char: q.question_text, trait: q.answers[0].answer_text }));
            if (items.length === 0) { renderFinalResult(); return; }
            const shuffledTraits = [...items].sort(() => Math.random() - 0.5);
            let charactersHTML = items.map(item => `<button type="button" id="char-${item.id}" class="draggable-item" draggable="true" data-item-id="${item.id}">${item.char}</button>`).join('');
            let traitsHTML = shuffledTraits.map(item => `<button type="button" class="drop-zone" data-correct-id="${item.id}"><span class="trait-text">${item.trait}</span></button>`).join('');
            const progress = Math.round((roundNum / totalRounds) * 100);
            container.innerHTML = `<div class="quiz-container-player association-player"><div class="quiz-progress-wrap"><div class="quiz-progress-meta"><span>Fase ${roundNum} de ${totalRounds}</span><strong>${totalScore} acertos</strong></div><div class="quiz-progress-track"><span style="width: ${progress}%"></span></div></div><h2 class="text-page-title association-title">${quiz.title}</h2><div class="association-game-area"><div class="association-column draggable-column"><p class="association-column-label">Itens</p>${charactersHTML}</div><div class="association-column droppable-column"><p class="association-column-label">Combinações</p>${traitsHTML}</div></div><p id="round-score"></p><button id="action-button" class="card-button hidden" style="margin-top: 30px;">Verificar Respostas</button></div>`;
            addDragDropListeners(items.length);
        }
        function addDragDropListeners(questionsInRound) {
            let selectedItem = null; const actionButton = document.getElementById('action-button');
            function updateActionButton() {
                const filledZones = document.querySelectorAll('.drop-zone .draggable-item').length;
                actionButton.classList.toggle('hidden', filledZones !== questionsInRound);
            }
            function clearSelection() { document.querySelectorAll('.draggable-item.selected').forEach(item => item.classList.remove('selected')); selectedItem = null; }
            function placeItemInZone(item, zone) {
                if (!item || zone.querySelector('.draggable-item')) return;
                zone.appendChild(item);
                item.classList.remove('selected');
                item.draggable = true;
                clearSelection();
                updateActionButton();
            }
            document.querySelectorAll('.draggable-item').forEach(draggable => {
                draggable.addEventListener('click', () => {
                    if (selectedItem === draggable) { clearSelection(); return; }
                    clearSelection();
                    selectedItem = draggable;
                    draggable.classList.add('selected');
                });
                draggable.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', e.target.id); setTimeout(() => e.target.classList.add('dragging'), 0); });
                draggable.addEventListener('dragend', () => draggable.classList.remove('dragging'));
            });
            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.addEventListener('dragover', e => { e.preventDefault(); if (!zone.querySelector('.draggable-item')) zone.classList.add('drag-over'); });
                zone.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
                zone.addEventListener('drop', e => {
                    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
                    const charId = e.dataTransfer.getData('text/plain'); const charElement = document.getElementById(charId);
                    placeItemInZone(charElement, e.currentTarget);
                });
                zone.addEventListener('click', e => {
                    if (e.currentTarget.querySelector('.draggable-item')) return;
                    placeItemInZone(selectedItem, e.currentTarget);
                });
            });
            actionButton.addEventListener('click', checkAnswers, { once: true });
        }
        function checkAnswers() {
            let roundCorrectAnswers = 0;
            document.querySelectorAll('.drop-zone').forEach(zone => {
                const droppedItem = zone.querySelector('.draggable-item');
                if (droppedItem) droppedItem.draggable = false;
                if (droppedItem && droppedItem.dataset.itemId === zone.dataset.correctId) { zone.classList.add('correct'); roundCorrectAnswers++; }
                else { zone.classList.add('incorrect'); }
            });
            totalScore += roundCorrectAnswers;
            document.getElementById('round-score').innerText = `Você acertou ${roundCorrectAnswers} de ${document.querySelectorAll('.drop-zone').length} nesta fase!`;
            const actionButton = document.getElementById('action-button');
            if (currentRound < totalRounds) { actionButton.innerText = "Próxima Fase"; actionButton.addEventListener('click', () => { currentRound++; renderRound(currentRound); }, { once: true });
            } else { actionButton.innerText = "Ver Resultado Final"; actionButton.addEventListener('click', renderFinalResult, { once: true }); }
        }
        function renderFinalResult() {
            const totalPossible = questions.length; let message = (totalScore / totalPossible) * 100 < 70 ? "Foi quase! Tente de novo." : "Excelente!";
            container.innerHTML = `<div class="quiz-container-player association-player quiz-mode-result"><p class="quiz-result-kicker">Jogo finalizado</p><h2>${message}</h2><p id="result-score">${totalScore}/${totalPossible}</p><p>Você acertou ${totalScore} de ${totalPossible} no total.</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`;
            container.querySelector('#restart-button').addEventListener('click', startGame);
        }
        function startGame() { currentRound = 1; totalScore = 0; renderRound(currentRound); }
        startGame();
    }

    // --- INICIALIZAÇÃO E EVENT LISTENERS GERAIS ---
    const hasStaticPostContent = cleanPath.startsWith('/posts/') && !!document.querySelector('#post-container .text-page-content');
    if (cleanPath === '/' || pagePath.includes('index.html')) { loadHomePage(); }
    else if (cleanPath === '/filmes' || pagePath.includes('filmes.html')) { loadPostsPage('filme'); }
    else if (cleanPath === '/series' || pagePath.includes('series.html')) { loadPostsPage('serie'); }
    else if (pagePath.includes('post.html') || (cleanPath.startsWith('/posts/') && !hasStaticPostContent)) { loadSinglePostPage(); }
    else if (cleanPath === '/quizzes' || pagePath.includes('quizzes.html')) { loadQuizzesPage(); }
    else if (pagePath.includes('play-quiz.html') || cleanPath.startsWith('/quiz/')) { loadQuizPlayer(); }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) { searchInput.addEventListener('input', () => { if (cleanPath === '/filmes' || pagePath.includes('filmes.html')) loadPostsPage('filme'); if (cleanPath === '/series' || pagePath.includes('series.html')) loadPostsPage('serie'); }); }
    const menuIcon = document.querySelector('.menu-icon');
    const sideMenu = document.querySelector('.side-menu');
    if (menuIcon) { menuIcon.addEventListener('click', () => sideMenu.classList.toggle('open')); }
    document.addEventListener('click', (event) => { if (sideMenu && sideMenu.classList.contains('open') && !sideMenu.contains(event.target) && !menuIcon.contains(event.target)) { sideMenu.classList.remove('open'); } });
    document.querySelectorAll('.theme-dot').forEach(dot => { dot.addEventListener('click', () => { const theme = dot.dataset.theme; document.body.dataset.theme = theme; localStorage.setItem('theme', theme); }); });
});
