const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'seriesnomundo_ai_post_queue_v1';
    const MAX_QUEUE_ITEMS = 50;
    const STATUS_LABELS = {
        pending: 'Pendente',
        generating: 'Gerando',
        done: 'Pronto',
        error: 'Erro'
    };

    const loginPanel = document.getElementById('login-panel');
    const aiContent = document.getElementById('ai-content');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginMessage = document.getElementById('login-message');
    const authStatus = document.getElementById('auth-status');
    const briefingsInput = document.getElementById('briefings-input');
    const generationCount = document.getElementById('generation-count');
    const prepareBtn = document.getElementById('prepare-btn');
    const generateBtn = document.getElementById('generate-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const statusMessage = document.getElementById('status-message');
    const queueList = document.getElementById('queue-list');
    const pendingCount = document.getElementById('pending-count');
    const generatingCount = document.getElementById('generating-count');
    const doneCount = document.getElementById('done-count');
    const errorCount = document.getElementById('error-count');

    let queue = loadQueue();
    let isGenerating = false;
    let shouldPause = false;

    function setStatus(message, type = '') {
        statusMessage.innerText = message;
        statusMessage.className = `status ${type}`.trim();
    }

    function showLogin() {
        loginPanel.classList.remove('hidden');
        aiContent.classList.add('hidden');
        authStatus.innerText = '';
    }

    function showTool(session) {
        loginPanel.classList.add('hidden');
        aiContent.classList.remove('hidden');
        authStatus.innerText = session?.user?.email ? `Conectado como ${session.user.email}` : '';
        renderQueue();
    }

    async function handleLogin(event) {
        event.preventDefault();
        loginMessage.innerText = 'Entrando...';

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: loginEmail.value.trim(),
            password: loginPassword.value
        });

        if (error) {
            loginMessage.innerText = 'Login invalido. Confira e-mail e senha.';
            return;
        }

        loginPassword.value = '';
        loginMessage.innerText = '';
        showTool(data.session);
    }

    async function getAccessToken() {
        const { data } = await supabaseClient.auth.getSession();
        return data.session?.access_token || '';
    }

    function splitBriefings(rawText) {
        return String(rawText || '')
            .split(/\n\s*---+\s*\n/g)
            .map(section => section.trim())
            .filter(Boolean);
    }

    function createQueueItem(briefing, index) {
        return {
            id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
            briefing,
            result: '',
            error: '',
            debug: null,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    function loadQueue() {
        try {
            const savedQueue = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(savedQueue) ? savedQueue.map(item => ({
                ...item,
                status: item.status === 'generating' ? 'pending' : item.status
            })) : [];
        } catch (_error) {
            return [];
        }
    }

    function saveQueue() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }

    function updateItem(id, data) {
        queue = queue.map(item => item.id === id ? {
            ...item,
            ...data,
            updatedAt: new Date().toISOString()
        } : item);
        saveQueue();
        renderQueue();
    }

    function getCounts() {
        return queue.reduce((summary, item) => {
            summary[item.status] = (summary[item.status] || 0) + 1;
            return summary;
        }, { pending: 0, generating: 0, done: 0, error: 0 });
    }

    function renderQueue() {
        const counts = getCounts();
        pendingCount.innerText = counts.pending || 0;
        generatingCount.innerText = counts.generating || 0;
        doneCount.innerText = counts.done || 0;
        errorCount.innerText = counts.error || 0;
        generateBtn.disabled = isGenerating || queue.length === 0 || (counts.pending || 0) === 0;
        pauseBtn.disabled = !isGenerating;
        copyAllBtn.disabled = (counts.done || 0) === 0;

        if (!queue.length) {
            queueList.innerHTML = '<p class="queue-meta">Nenhum texto na fila ainda.</p>';
            return;
        }

        queueList.innerHTML = queue.map((item, index) => {
            const status = item.status || 'pending';
            const preview = item.briefing.length > 360 ? `${item.briefing.slice(0, 360)}...` : item.briefing;
            const resultTextarea = item.result
                ? `<label for="result-${item.id}">Rascunho gerado:</label><textarea id="result-${item.id}" class="draft-output" readonly>${escapeHTML(item.result)}</textarea>`
                : '';
            const errorHtml = item.error ? `<p class="status error">${escapeHTML(item.error)}</p>` : '';
            const usage = item.debug?.usage;
            const debugHtml = usage?.total_tokens ? `<div class="queue-meta">Tokens: ${usage.total_tokens} total (${usage.prompt_tokens} entrada + ${usage.completion_tokens} saida) | Revisao extra: ${item.debug.polished ? 'sim' : 'nao'} | Tempo: ${item.debug.seconds || 0}s</div>` : '';
            const retryButton = status === 'error' ? `<button type="button" class="form-cancel-btn" data-action="retry" data-id="${item.id}">Tentar de novo</button>` : '';
            const copyButton = item.result ? `<button type="button" class="copy-btn" data-action="copy" data-id="${item.id}">Copiar post</button>` : '';

            return `
                <article class="queue-item is-${status}">
                    <div class="queue-header">
                        <div>
                            <div class="queue-title">Texto ${index + 1}</div>
                            <div class="queue-meta">${item.briefing.length} caracteres de base</div>
                        </div>
                        <span class="queue-badge ${status}">${STATUS_LABELS[status] || status}</span>
                    </div>
                    <div class="queue-preview">${escapeHTML(preview)}</div>
                    ${errorHtml}
                    ${debugHtml}
                    ${resultTextarea}
                    <div class="item-actions">
                        ${copyButton}
                        ${retryButton}
                    </div>
                </article>
            `;
        }).join('');
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function prepareQueue() {
        const sections = splitBriefings(briefingsInput.value);
        if (!sections.length) {
            setStatus('Cole pelo menos um texto base separado por --- antes de preparar.', 'error');
            return;
        }

        const limitedSections = sections.slice(0, MAX_QUEUE_ITEMS);
        queue = limitedSections.map(createQueueItem);
        saveQueue();
        renderQueue();
        setStatus(`${limitedSections.length} texto${limitedSections.length > 1 ? 's' : ''} preparado${limitedSections.length > 1 ? 's' : ''} na fila.`, 'success');
        if (sections.length > MAX_QUEUE_ITEMS) {
            setStatus(`Foram encontrados ${sections.length} textos, mas a fila foi limitada aos primeiros ${MAX_QUEUE_ITEMS}.`, 'error');
        }
    }

    async function requestGeneratedPost({ briefing, accessToken, index }) {
        const response = await fetch('/api/generate-posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ count: 1, briefings: briefing })
        });

        const responseText = await response.text();
        let result = {};
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch (_error) {
            throw new Error(`Erro inesperado da Vercel (${response.status}). Tente novamente neste item.`);
        }

        if (!response.ok) {
            const debugParts = [];
            if (result.debug?.model) debugParts.push(`modelo: ${result.debug.model}`);
            if (result.debug?.stage) debugParts.push(`etapa: ${result.debug.stage}`);
            if (result.debug?.status) debugParts.push(`status: ${result.debug.status}`);
            const debugMessage = debugParts.length ? ` (${debugParts.join(' | ')})` : '';
            throw new Error(`${result.error || `Nao foi possivel gerar o post ${index}.`}${debugMessage}`);
        }

        if (!result.content) throw new Error(`A IA respondeu vazia no post ${index}.`);
        return {
            content: result.content.trim(),
            debug: result.debug || null
        };
    }

    async function generateQueue() {
        if (isGenerating) return;
        if (!queue.length) {
            setStatus('Prepare a fila antes de gerar.', 'error');
            return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
            setStatus('Sessao expirada. Entre novamente.', 'error');
            showLogin();
            return;
        }

        const amount = Math.min(parseInt(generationCount.value, 10) || 1, MAX_QUEUE_ITEMS);
        const pendingItems = queue.filter(item => item.status === 'pending').slice(0, amount);
        if (!pendingItems.length) {
            setStatus('Nao existem textos pendentes para gerar.', 'error');
            return;
        }

        isGenerating = true;
        shouldPause = false;
        renderQueue();
        const startedAt = Date.now();
        let generated = 0;
        let failed = 0;

        for (const item of pendingItems) {
            if (shouldPause) break;

            const itemIndex = queue.findIndex(queueItem => queueItem.id === item.id) + 1;
            updateItem(item.id, { status: 'generating', error: '' });
            setStatus(`Gerando texto ${itemIndex} de ${queue.length}...`, '');

            try {
                const generatedPost = await requestGeneratedPost({ briefing: item.briefing, accessToken, index: itemIndex });
                generated += 1;
                updateItem(item.id, { status: 'done', result: generatedPost.content, error: '', debug: generatedPost.debug });
            } catch (error) {
                failed += 1;
                updateItem(item.id, { status: 'error', error: error.message || 'Erro desconhecido ao gerar este post.' });
                shouldPause = true;
            }
        }

        isGenerating = false;
        shouldPause = false;
        renderQueue();

        const seconds = Math.round((Date.now() - startedAt) / 1000);
        if (failed) {
            setStatus(`${generated} pronto${generated === 1 ? '' : 's'}, ${failed} com erro, em ${seconds}s.`, 'error');
        } else if (generated) {
            setStatus(`${generated} post${generated === 1 ? '' : 's'} gerado${generated === 1 ? '' : 's'} em ${seconds}s.`, 'success');
        } else {
            setStatus('Fila pausada.', '');
        }
    }

    async function copyText(text, successMessage) {
        if (!text.trim()) {
            setStatus('Nao tem texto pronto para copiar.', 'error');
            return;
        }

        await navigator.clipboard.writeText(text);
        setStatus(successMessage, 'success');
    }

    function copyAllDone() {
        const contents = queue
            .filter(item => item.status === 'done' && item.result.trim())
            .map(item => item.result.trim());

        copyText(contents.join('\n\n\n'), `${contents.length} post${contents.length === 1 ? '' : 's'} copiado${contents.length === 1 ? '' : 's'}.`);
    }

    function retryItem(id) {
        updateItem(id, { status: 'pending', error: '', result: '', debug: null });
        setStatus('Item voltou para a fila.', 'success');
    }

    function clearQueue() {
        if (isGenerating) {
            setStatus('Pause a fila antes de limpar.', 'error');
            return;
        }

        queue = [];
        briefingsInput.value = '';
        localStorage.removeItem(STORAGE_KEY);
        renderQueue();
        setStatus('Fila limpa.', 'success');
    }

    loginForm.addEventListener('submit', handleLogin);
    prepareBtn.addEventListener('click', prepareQueue);
    generateBtn.addEventListener('click', generateQueue);
    pauseBtn.addEventListener('click', () => {
        shouldPause = true;
        pauseBtn.disabled = true;
        setStatus('Pausando apos o post atual terminar...', '');
    });
    clearBtn.addEventListener('click', clearQueue);
    copyAllBtn.addEventListener('click', copyAllDone);
    queueList.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const item = queue.find(queueItem => queueItem.id === button.dataset.id);
        if (!item) return;

        if (button.dataset.action === 'copy') {
            copyText(item.result, 'Post copiado.');
        } else if (button.dataset.action === 'retry') {
            retryItem(item.id);
        }
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session) showTool(session);
        else showLogin();
    });

    supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) showTool(data.session);
        else showLogin();
    });

    renderQueue();
});
