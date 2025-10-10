// Suas chaves do Supabase
const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // --- SELETORES GERAIS E ESTADO DA APLICAÇÃO ---
    // =================================================================
    const postsList = document.getElementById('posts-list');
    const showPostFormBtn = document.getElementById('show-post-form-btn');
    const postForm = document.getElementById('post-form');
    const postFormCancelBtn = document.getElementById('post-form-cancel-btn');
    
    const quizzesList = document.getElementById('quizzes-list');
    const showQuizFormBtn = document.getElementById('show-quiz-form-btn');
    const quizForm = document.getElementById('quiz-form');
    const quizTypeSelect = document.getElementById('quiz-type');
    const quizFormCancelBtn = document.getElementById('quiz-form-cancel-btn');
    const quizQuestionsWrappers = document.getElementById('quiz-questions-wrappers');

    let editingPostId = null;
    let editingQuizId = null;

    // =================================================================
    // --- LÓGICA DE POSTS ---
    // =================================================================
    
    async function getPosts() {
        let { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
        if (error) { console.error('Erro ao buscar posts:', error); return; }
        
        postsList.innerHTML = '';
        if (!posts || posts.length === 0) { postsList.innerHTML = '<li>Nenhum post encontrado.</li>'; }
        else {
            posts.forEach(post => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span>${post.title}</span><div class="actions-group"><button class="edit-btn">Editar</button><button class="delete-btn" data-id="${post.id}" data-title="${post.title}">Apagar</button></div>`;
                postsList.appendChild(listItem);
                listItem.querySelector('.edit-btn').addEventListener('click', () => showPostEditForm(post));
            });
        }
        addPostDeleteListeners();
    }

    function addPostDeleteListeners() {
        document.querySelectorAll('#posts-list .delete-btn').forEach(button => {
            const newButton = button.cloneNode(true); button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async (event) => {
                const postId = event.target.dataset.id;
                const postTitle = event.target.dataset.title;
                if (confirm(`Tem certeza que quer apagar o post: "${postTitle}"?`)) {
                    const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
                    if (error) { alert(`Erro ao apagar: ${error.message}`); } else { getPosts(); }
                }
            });
        });
    }

    function showPostCreateForm() { editingPostId = null; document.getElementById('post-form-title').innerText = 'Criar Novo Post'; postForm.reset(); postForm.classList.remove('hidden'); showPostFormBtn.classList.add('hidden');}
    function showPostEditForm(post) { editingPostId = post.id; document.getElementById('post-form-title').innerText = `Editando: "${post.title}"`; postForm.reset(); document.getElementById('post-id').value = post.id; document.getElementById('post-title').value = post.title; document.getElementById('post-description').value = post.description; document.getElementById('post-content').value = post.content; document.getElementById('post-category').value = post.category; document.getElementById('post-is_featured').checked = post.is_featured; postForm.classList.remove('hidden'); showPostFormBtn.classList.add('hidden'); }
    function hidePostForm() { postForm.classList.add('hidden'); showPostFormBtn.classList.remove('hidden'); postForm.reset(); editingPostId = null;}
    
    async function handlePostFormSubmit(event) {
        event.preventDefault();
        const postData = {title: document.getElementById('post-title').value, description: document.getElementById('post-description').value, content: document.getElementById('post-content').value, category: document.getElementById('post-category').value, is_featured: document.getElementById('post-is_featured').checked,};
        let error;
        if (editingPostId) { ({ error } = await supabaseClient.from('posts').update(postData).eq('id', editingPostId)); } else { ({ error } = await supabaseClient.from('posts').insert([postData])); }
        if (error) { alert(`Erro: ${error.message}`); } else { alert(editingPostId ? 'Post atualizado!' : 'Post criado!'); hidePostForm(); getPosts(); }
    }

    // =================================================================
    // --- LÓGICA DE QUIZZES ---
    // =================================================================

    async function getQuizzes() {
        let { data: quizzes, error } = await supabaseClient.from('quizzes').select('*').order('created_at', { ascending: false });
        if (error) { console.error('Erro ao buscar quizzes:', error); return; }
        
        quizzesList.innerHTML = '';
        if (!quizzes || quizzes.length === 0) { quizzesList.innerHTML = '<li>Nenhum quiz encontrado.</li>'; }
        else {
            quizzes.forEach(quiz => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span>${quiz.title} (${quiz.quiz_type})</span><div class="actions-group"><button class="edit-quiz-btn" data-id="${quiz.id}">Editar</button><button class="delete-quiz-btn" data-id="${quiz.id}" data-title="${quiz.title}">Apagar</button></div>`;
                quizzesList.appendChild(listItem);
            });
        }
        addQuizActionListeners();
    }

    function addQuizActionListeners() {
        document.querySelectorAll('.delete-quiz-btn').forEach(button => {
            const newButton = button.cloneNode(true); button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async (e) => {
                const id = e.target.dataset.id; const title = e.target.dataset.title;
                if (confirm(`Tem certeza que quer apagar o quiz: "${title}"?\n\nATENÇÃO: Todas as suas perguntas e respostas também serão apagadas!`)) { await deleteQuiz(id); }
            });
        });
        document.querySelectorAll('.edit-quiz-btn').forEach(button => {
            const newButton = button.cloneNode(true); button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const { data: quiz, error } = await supabaseClient.from('quizzes').select('*').eq('id', id).single();
                if (error) { alert("Não foi possível carregar os dados do quiz para edição."); } else { showQuizEditForm(quiz); }
            });
        });
    }

    async function deleteQuiz(quizId) {
        const { data: questions } = await supabaseClient.from('questions').select('id').eq('quiz_id', quizId);
        if (questions && questions.length > 0) {
            const questionIds = questions.map(q => q.id);
            await supabaseClient.from('answers').delete().in('question_id', questionIds);
        }
        await supabaseClient.from('questions').delete().eq('quiz_id', quizId);
        const { error } = await supabaseClient.from('quizzes').delete().eq('id', quizId);
        if (error) { alert("Erro ao apagar o quiz."); }
        else { alert("Quiz apagado com sucesso!"); getQuizzes(); }
    }

    function showQuizCreateForm() {
        editingQuizId = null; quizForm.reset(); quizQuestionsWrappers.innerHTML = ''; quizTypeSelect.disabled = false;
        document.getElementById('quiz-form-title').innerText = 'Criar Novo Quiz';
        quizForm.classList.remove('hidden'); showQuizFormBtn.classList.add('hidden');
    }

    async function showQuizEditForm(quiz) {
        editingQuizId = quiz.id; quizForm.reset(); quizQuestionsWrappers.innerHTML = '';
        document.getElementById('quiz-form-title').innerText = `Editando Quiz: "${quiz.title}"`;
        document.getElementById('quiz-id').value = quiz.id;
        document.getElementById('quiz-title').value = quiz.title;
        document.getElementById('quiz-description').value = quiz.description;
        document.getElementById('quiz-is_featured').checked = quiz.is_featured;
        quizTypeSelect.value = quiz.quiz_type;
        quizTypeSelect.disabled = true;
        
        handleQuizTypeChange(true);
        
        quizQuestionsWrappers.innerHTML = '<h3>Carregando perguntas...</h3>';
        const { data: questions, error } = await supabaseClient.from('questions').select('*, answers(*)').eq('quiz_id', quiz.id).order('id');
        if(error) { alert("Erro ao carregar as perguntas deste quiz."); return; }

        populateQuestionFields(quiz.quiz_type, questions);

        quizForm.classList.remove('hidden'); showQuizFormBtn.classList.add('hidden');
    }

    function hideQuizForm() { quizForm.classList.add('hidden'); showQuizFormBtn.classList.remove('hidden'); quizForm.reset(); editingQuizId = null; }

    function handleQuizTypeChange(isEditing = false) {
        const selectedType = quizTypeSelect.value;
        quizQuestionsWrappers.innerHTML = '';
        let formHTML = '';
        switch(selectedType) {
            case 'true_false': formHTML = `<hr><h3>Perguntas (Verdadeiro ou Falso)</h3><div id="questions-container"></div><button type="button" class="add-question-btn">+ Adicionar</button>`; break;
            case 'trivia': case 'who_am_i': formHTML = `<hr><h3>Perguntas (Múltipla Escolha)</h3><div id="questions-container"></div><button type="button" class="add-question-btn">+ Adicionar</button>`; break;
            case 'personality': formHTML = `<hr><label for="personality-results">Resultados Possíveis (separe por vírgula):</label><input type="text" id="personality-results" placeholder="Ex: Homem de Ferro, Capitão América"><hr><h3>Perguntas</h3><div id="questions-container"></div><button type="button" class="add-question-btn">+ Adicionar</button>`; break;
            case 'association': formHTML = `<hr><h3>Pares para Associar</h3><div id="questions-container"></div><button type="button" class="add-question-btn">+ Adicionar</button>`; break;
        }
        quizQuestionsWrappers.innerHTML = formHTML;
        const addBtn = document.querySelector('#quiz-form .add-question-btn');
        if (addBtn) { addBtn.addEventListener('click', () => addQuestionField(selectedType)); }
        if (!isEditing) addQuestionField(selectedType);
    }
    
    function addQuestionField(type, data = {}) {
        const container = document.getElementById('questions-container');
        if (!container) return;
        const questionCount = container.children.length;
        const newField = document.createElement('div');
        newField.className = 'question-item';
        let content = `<button type="button" class="delete-question-btn">X</button><label>Pergunta ${questionCount + 1}:</label><input type="text" class="question-text" value="${data.question_text || ''}" required>`;
        switch(type) {
            case 'true_false': content += `<label>Resposta:</label><select class="is-true"><option value="true" ${data.is_true ? 'selected' : ''}>Verdadeira</option><option value="false" ${!data.is_true ? 'selected' : ''}>Falsa</option></select>`; break;
            case 'trivia': case 'who_am_i':
                let answersHTML = '';
                for(let i=0; i<4; i++) { answersHTML += `<div class="answer-group"><input type="radio" name="correct_answer_${questionCount}" value="${i}" ${data.answers && data.answers[i]?.is_correct ? 'checked' : ''} required><input type="text" placeholder="Alternativa ${i+1}" class="answer-text" value="${data.answers && data.answers[i]?.answer_text || ''}"></div>`; }
                content += `<div class="answer-group"><label>Alternativas (marque a correta):</label></div>${answersHTML}`;
                break;
            case 'personality':
                 const results = document.getElementById('personality-results').value.split(',').map(r => r.trim()).filter(r => r);
                 if (results.length === 0 && (!data.answers || data.answers.length === 0)) { alert('Primeiro, preencha os Resultados Possíveis!'); newField.remove(); return; }
                 let personalityAnswersHTML = '';
                 for(let i=0; i<3; i++) { personalityAnswersHTML += `<div class="answer-group"><input type="text" placeholder="Texto da Alt. ${i+1}" class="answer-text" value="${data.answers && data.answers[i]?.answer_text || ''}"><select class="points-to">${results.map(r => `<option value="${r}" ${data.answers && data.answers[i]?.points_to === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`; }
                 content += `<div class="answer-group"><label>Alternativas e Pontos:</label></div>${personalityAnswersHTML}`;
                break;
            case 'association': content += `<div class="answer-group"><label>Item 2 (para ligar com o texto da pergunta):</label><input type="text" placeholder="Ex: Frase" class="answer-text" value="${data.answers && data.answers[0]?.answer_text || ''}"></div>`; break;
        }
        newField.innerHTML = content;
        container.appendChild(newField);
        newField.querySelector('.delete-question-btn').addEventListener('click', () => newField.remove());
    }

    function populateQuestionFields(type, questions) {
        const container = document.getElementById('questions-container');
        if(!container) return;
        container.innerHTML = '';
        if (type === 'personality') {
            const results = questions.flatMap(q => q.answers.map(a => a.points_to));
            document.getElementById('personality-results').value = [...new Set(results)].join(', ');
        }
        questions.forEach(q => addQuestionField(type, q));
    }
    
    async function handleQuizFormSubmit(event) {
        event.preventDefault();
        const quizType = quizTypeSelect.value;
        const quizPayload = { title: document.getElementById('quiz-title').value, description: document.getElementById('quiz-description').value, quiz_type: quizType, is_featured: document.getElementById('quiz-is_featured').checked, };
        let quizId = editingQuizId;
        
        if (editingQuizId) {
            const { error } = await supabaseClient.from('quizzes').update(quizPayload).eq('id', editingQuizId);
            if (error) { alert('Erro ao atualizar o quiz: ' + error.message); return; }
            const { data: questions } = await supabaseClient.from('questions').select('id').eq('quiz_id', editingQuizId);
            if (questions && questions.length > 0) {
                const qIds = questions.map(q => q.id);
                await supabaseClient.from('answers').delete().in('question_id', qIds);
                await supabaseClient.from('questions').delete().eq('quiz_id', editingQuizId);
            }
        } else {
            const { data, error } = await supabaseClient.from('quizzes').insert(quizPayload).select().single();
            if (error) { alert('Erro ao criar o quiz: ' + error.message); return; }
            quizId = data.id;
        }

        let finalError = null;
        const questionsContainer = document.getElementById('questions-container');
        
        switch (quizType) {
            case 'true_false':
                const tfQuestions = [...questionsContainer.children].map(item => ({ question_text: item.querySelector('.question-text').value, is_true: item.querySelector('.is-true').value === 'true', quiz_id: quizId }));
                if(tfQuestions.length > 0) { finalError = (await supabaseClient.from('questions').insert(tfQuestions)).error; }
                break;

            case 'trivia': case 'who_am_i':
                const triviaQuestions = [...questionsContainer.children].map(item => ({ question_text: item.querySelector('.question-text').value, quiz_id: quizId }));
                if(triviaQuestions.length === 0) break;
                const { data: createdQuestions, error: tqError } = await supabaseClient.from('questions').insert(triviaQuestions).select();
                if (tqError) { finalError = tqError; break; }
                const triviaAnswers = [];
                [...questionsContainer.children].forEach((item, qIndex) => {
                    const questionId = createdQuestions[qIndex].id;
                    const correctAnswerIndex = item.querySelector(`input[name*="correct_answer"]:checked`)?.value;
                    item.querySelectorAll('.answer-text').forEach((answerInput, aIndex) => { if(answerInput.value) triviaAnswers.push({ answer_text: answerInput.value, is_correct: parseInt(correctAnswerIndex) === aIndex, question_id: questionId }); });
                });
                if(triviaAnswers.length > 0) finalError = (await supabaseClient.from('answers').insert(triviaAnswers)).error;
                break;
            
            case 'personality':
                const pQuestions = [...questionsContainer.children].map(item => ({ question_text: item.querySelector('.question-text').value, quiz_id: quizId }));
                if(pQuestions.length === 0) break;
                const { data: createdPQuestions, error: pqError } = await supabaseClient.from('questions').insert(pQuestions).select();
                if (pqError) { finalError = pqError; break; }
                const pAnswers = [];
                [...questionsContainer.children].forEach((item, qIndex) => {
                    const qId = createdPQuestions[qIndex].id;
                    item.querySelectorAll('.answer-group').forEach(group => {
                        const text = group.querySelector('.answer-text'); const points = group.querySelector('.points-to');
                        if (text && points && text.value) { pAnswers.push({ answer_text: text.value, points_to: points.value, question_id: qId, is_correct: false }); }
                    });
                });
                if(pAnswers.length > 0) finalError = (await supabaseClient.from('answers').insert(pAnswers)).error;
                break;

            case 'association':
                const assocQuestions = [...questionsContainer.children].map(item => ({ question_text: item.querySelector('.question-text').value, quiz_id: quizId }));
                if(assocQuestions.length === 0) break;
                const { data: createdAQuestions, error: aqError } = await supabaseClient.from('questions').insert(assocQuestions).select();
                if (aqError) { finalError = aqError; break; }
                const assocAnswers = [...questionsContainer.children].map((item, qIndex) => ({ answer_text: item.querySelector('.answer-text').value, is_correct: true, question_id: createdAQuestions[qIndex].id }));
                if(assocAnswers.length > 0) finalError = (await supabaseClient.from('answers').insert(assocAnswers)).error;
                break;
        }

        if (finalError) { alert('Erro ao salvar detalhes do quiz: ' + finalError.message); }
        else { alert(editingQuizId ? 'Quiz atualizado com sucesso!' : 'Quiz criado com sucesso!'); hideQuizForm(); getQuizzes(); }
    }
    
    // --- INICIALIZAÇÃO ---
    getPosts();
    getQuizzes();
});