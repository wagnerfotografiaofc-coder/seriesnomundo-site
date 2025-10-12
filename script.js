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

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
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
                <a href="post.html?id=${post.id}" class="suggestion-button">
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

    // --- FUNÇÕES DE CARREGAMENTO DE PÁGINA ---
    async function loadHomePage() {
        const { data: featuredFilmes } = await supabaseClient.from('posts').select('*').eq('category', 'filme').eq('is_featured', true).limit(3);
        const { data: featuredSeries } = await supabaseClient.from('posts').select('*').eq('category', 'serie').eq('is_featured', true).limit(3);
        const { data: featuredQuiz } = await supabaseClient.from('quizzes').select('*').eq('is_featured', true).limit(1);
        renderCardGrid('filmes-destaque-grid', featuredFilmes, 'post');
        renderCardGrid('series-destaque-grid', featuredSeries, 'post');
        if (featuredQuiz && featuredQuiz.length > 0) { renderCardGrid('quiz-destaque-grid', featuredQuiz, 'quiz'); }
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
        if (error) { console.error("Erro ao buscar quizzes:", error); }
        else { renderCardGrid('quizzes-grid-container', data, 'quiz'); }
    }

    async function loadSinglePostPage() {
    const postId = new URLSearchParams(window.location.search).get('id');
    if (!postId) { document.body.innerHTML = '<h1>Post não encontrado.</h1>'; return; }
    
    // 1. Busca o post principal
    const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
    if (error) { document.body.innerHTML = '<h1>Erro ao carregar o post.</h1>'; return; }
    
    document.title = `${post.title} - SeriesNoMundo`;
    const imagePath = post.image_url || (post.category === 'filme' ? 'imagens/1.png' : 'imagens/2.png');
    document.getElementById('post-container').innerHTML = `<button class="card-button" id="back-button" style="margin-bottom: 30px;">&lt; Voltar</button><h1 class="text-page-title">${post.title}</h1><img src="${imagePath}" alt="${post.title}" class="text-page-image"><div class="text-page-content">${post.content}</div>`;
    document.getElementById('back-button').addEventListener('click', () => { history.back(); });

    // 2. Lógica de Sugestão por Tags (a parte nova e correta)
    let suggestions = [];
    // Primeiro, tenta buscar por tags
    if (post.tags && post.tags.length > 0) {
        const { data: tagSuggestions } = await supabaseClient
            .from('posts')
            .select('*')
            .contains('tags', post.tags) // Busca posts que contenham QUALQUER uma das tags
            .neq('id', post.id)          // Garante que não vai sugerir o próprio post
            .limit(3);
        suggestions = tagSuggestions;
    }

    // Se não encontrou sugestões por tag (ou o post não tem tags), usa a busca por categoria como um PLANO B.
    if (!suggestions || suggestions.length === 0) {
        const { data: categorySuggestions } = await supabaseClient
            .from('posts')
            .select('*')
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
        const quizId = new URLSearchParams(window.location.search).get('id');
        const container = document.getElementById('quiz-player-container');
        if (!quizId) { container.innerHTML = '<h1>Quiz não encontrado.</h1>'; return; }
        const { data: quiz, error } = await supabaseClient.from('quizzes').select('*').eq('id', quizId).single();
        if (error) { container.innerHTML = '<h1>Erro ao carregar o quiz.</h1>'; return; }
        document.title = `${quiz.title} - SeriesNoMundo`;
        switch (quiz.quiz_type) {
            case 'true_false': await playTrueFalseQuiz(quiz); break;
            case 'trivia': case 'who_am_i': await playTriviaQuiz(quiz); break;
            case 'association': await playAssociationQuiz(quiz); break;
            default: container.innerHTML = `<h1>O motor para o quiz tipo "${quiz.quiz_type}" ainda está em construção!</h1>`;
        }
    }

    async function playTrueFalseQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('*').eq('quiz_id', quiz.id).order('id');
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas.</h1>'; return; }
        let currentQuestionIndex = 0; let score = 0; const container = document.getElementById('quiz-player-container');
        function renderQuestion() { const question = questions[currentQuestionIndex]; container.innerHTML = `<div class="quiz-container-player"><p>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</p><h2 class="text-page-title">${question.question_text}</h2><div class="tf-options"><button class="tf-btn" data-answer="true">Verdadeiro</button><button class="tf-btn" data-answer="false">Falso</button></div></div>`; document.querySelectorAll('.tf-btn').forEach(button => button.addEventListener('click', handleAnswer)); }
        function handleAnswer(e) { const userAnswer = e.target.dataset.answer === 'true'; const correctAnswer = questions[currentQuestionIndex].is_true; document.querySelectorAll('.tf-btn').forEach(btn => btn.disabled = true); if (userAnswer === correctAnswer) { e.target.classList.add('correct'); score++; } else { e.target.classList.add('incorrect'); const correctButton = document.querySelector(`.tf-btn[data-answer="${correctAnswer}"]`); if (correctButton) { correctButton.classList.add('correct'); } } setTimeout(nextStep, 1500); }
        function nextStep() { currentQuestionIndex++; if (currentQuestionIndex < questions.length) { renderQuestion(); } else { renderFinalResult(); } }
        function renderFinalResult() { let message = ""; const percentage = (score / questions.length) * 100; if (percentage <= 30) message = "Hmm, precisa estudar mais, hein?"; else if (percentage <= 70) message = "Bom trabalho!"; else if (percentage < 100) message = "Excelente!"; else message = "PERFEITO!"; container.innerHTML = `<div class="quiz-container-player"><h2>Quiz Finalizado!</h2><p id="result-score">Você acertou ${score} de ${questions.length}!</p><p>${message}</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`; container.querySelector('#restart-button').addEventListener('click', startQuiz); }
        function startQuiz() { currentQuestionIndex = 0; score = 0; renderQuestion(); }
        startQuiz();
    }

    async function playTriviaQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('*, answers(*)').eq('quiz_id', quiz.id);
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas deste quiz.</h1>'; return; }
        let currentQuestionIndex = 0; let score = 0; const container = document.getElementById('quiz-player-container');
        function renderQuestion() {
            const question = questions[currentQuestionIndex];
            let answersHTML = '';
            const shuffledAnswers = question.answers.sort(() => Math.random() - 0.5);
            shuffledAnswers.forEach(answer => { answersHTML += `<button class="answer-btn" data-correct="${answer.is_correct}">${answer.answer_text}</button>`; });
            container.innerHTML = `<div class="quiz-container-player"><p>Pergunta ${currentQuestionIndex + 1} de ${questions.length}</p><h2 class="text-page-title">${question.question_text}</h2><div class="answer-options">${answersHTML}</div><button id="next-button" class="card-button hidden" style="margin-top: 20px;">Próxima Pergunta</button></div>`;
            document.querySelectorAll('.answer-btn').forEach(button => button.addEventListener('click', handleAnswer));
        }
        function handleAnswer(e) {
            const selectedButton = e.target; const isCorrect = selectedButton.dataset.correct === 'true';
            document.querySelectorAll('.answer-btn').forEach(btn => { btn.disabled = true; if (btn.dataset.correct === 'true') { btn.classList.add('correct'); } });
            if (!isCorrect) { selectedButton.classList.add('incorrect'); } else { score++; }
            if (currentQuestionIndex < questions.length - 1) { const nextButton = document.getElementById('next-button'); nextButton.classList.remove('hidden'); nextButton.addEventListener('click', nextStep, { once: true });
            } else { setTimeout(renderFinalResult, 1500); }
        }
        function nextStep() { currentQuestionIndex++; renderQuestion(); }
        function renderFinalResult() { let message = ""; const percentage = (score / questions.length) * 100; if (percentage <= 30) message = "Hmm, precisa estudar mais, hein?"; else if (percentage <= 70) message = "Bom trabalho!"; else if (percentage < 100) message = "Excelente!"; else message = "PERFEITO!"; container.innerHTML = `<div class="quiz-container-player"><h2>Quiz Finalizado!</h2><p id="result-score">Você acertou ${score} de ${questions.length}!</p><p>${message}</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`; container.querySelector('#restart-button').addEventListener('click', startQuiz); }
        function startQuiz() { currentQuestionIndex = 0; score = 0; renderQuestion(); }
        startQuiz();
    }

    async function playAssociationQuiz(quiz) {
        const { data: questions, error } = await supabaseClient.from('questions').select('*, answers(answer_text)').eq('quiz_id', quiz.id);
        if (error || !questions || questions.length === 0) { document.getElementById('quiz-player-container').innerHTML = '<h1>Erro ao carregar as perguntas deste quiz.</h1>'; return; }
        
        let totalScore = 0; const itemsPerRound = 3; const totalRounds = Math.ceil(questions.length / itemsPerRound); let currentRound = 1; const container = document.getElementById('quiz-player-container');
        function renderRound(roundNum) {
            const startIndex = (roundNum - 1) * itemsPerRound; const roundQuestions = questions.slice(startIndex, startIndex + itemsPerRound);
            if (roundQuestions.length === 0) { renderFinalResult(); return; }
            const items = roundQuestions.map(q => ({ char: q.question_text, trait: q.answers[0].answer_text }));
            const shuffledTraits = [...items].sort(() => Math.random() - 0.5);
            let charactersHTML = items.map(item => `<div id="char-${item.char.replace(/\s+/g, '-')}" class="draggable-item" draggable="true">${item.char}</div>`).join('');
            let traitsHTML = shuffledTraits.map(item => `<div class="drop-zone" data-correct-char="${item.char}"><span class="trait-text">${item.trait}</span></div>`).join('');
            container.innerHTML = `<div class="quiz-container-player"><h2 class="text-page-title">${quiz.title} (Fase ${roundNum}/${totalRounds})</h2><div class="association-game-area"><div class="draggable-column">${charactersHTML}</div><div class="droppable-column">${traitsHTML}</div></div><p id="round-score"></p><button id="action-button" class="card-button hidden" style="margin-top: 30px;">Verificar Respostas</button></div>`;
            addDragDropListeners(roundQuestions.length);
        }
        function addDragDropListeners(questionsInRound) {
            let dropsMade = 0; const actionButton = document.getElementById('action-button');
            document.querySelectorAll('.draggable-item').forEach(draggable => { draggable.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', e.target.id); setTimeout(() => e.target.classList.add('dragging'), 0); }); draggable.addEventListener('dragend', () => draggable.classList.remove('dragging')); });
            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.addEventListener('dragover', e => { e.preventDefault(); if (!zone.querySelector('.draggable-item')) zone.classList.add('drag-over'); });
                zone.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
                zone.addEventListener('drop', e => {
                    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
                    const charId = e.dataTransfer.getData('text/plain'); const charElement = document.getElementById(charId);
                    if (e.currentTarget.querySelector('.draggable-item') || !charElement) return;
                    e.currentTarget.appendChild(charElement); dropsMade++;
                    if (dropsMade === questionsInRound) actionButton.classList.remove('hidden');
                });
            });
            actionButton.addEventListener('click', checkAnswers, { once: true });
        }
        function checkAnswers() {
            let roundCorrectAnswers = 0;
            document.querySelectorAll('.drop-zone').forEach(zone => {
                const droppedItem = zone.querySelector('.draggable-item');
                if (droppedItem) droppedItem.draggable = false;
                if (droppedItem && droppedItem.innerText === zone.dataset.correctChar) { zone.classList.add('correct'); roundCorrectAnswers++; }
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
            container.innerHTML = `<div class="quiz-container-player"><h2>Jogo Finalizado!</h2><p id="result-score">Você acertou ${totalScore} de ${totalPossible} no total!</p><p>${message}</p><button class="card-button" id="restart-button" style="margin-top: 30px;">Jogar Novamente</button></div>`;
            container.querySelector('#restart-button').addEventListener('click', startGame);
        }
        function startGame() { currentRound = 1; totalScore = 0; renderRound(currentRound); }
        startGame();
    }

    // --- INICIALIZAÇÃO E EVENT LISTENERS GERAIS ---
    if (pagePath.includes('index.html') || pagePath === '') { loadHomePage(); }
    else if (pagePath.includes('filmes.html')) { loadPostsPage('filme'); }
    else if (pagePath.includes('series.html')) { loadPostsPage('serie'); }
    else if (pagePath.includes('post.html')) { loadSinglePostPage(); }
    else if (pagePath.includes('quizzes.html')) { loadQuizzesPage(); }
    else if (pagePath.includes('play-quiz.html')) { loadQuizPlayer(); }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) { searchInput.addEventListener('input', () => { if (pagePath.includes('filmes.html')) loadPostsPage('filme'); if (pagePath.includes('series.html')) loadPostsPage('serie'); }); }
    const menuIcon = document.querySelector('.menu-icon');
    const sideMenu = document.querySelector('.side-menu');
    if (menuIcon) { menuIcon.addEventListener('click', () => sideMenu.classList.toggle('open')); }
    document.addEventListener('click', (event) => { if (sideMenu && sideMenu.classList.contains('open') && !sideMenu.contains(event.target) && !menuIcon.contains(event.target)) { sideMenu.classList.remove('open'); } });
    document.querySelectorAll('.theme-dot').forEach(dot => { dot.addEventListener('click', () => { const theme = dot.dataset.theme; document.body.dataset.theme = theme; localStorage.setItem('theme', theme); }); });
});