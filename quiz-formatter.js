const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const MAX_ITEMS = 50;
    const loginPanel = document.getElementById('login-panel');
    const toolContent = document.getElementById('tool-content');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginMessage = document.getElementById('login-message');
    const authStatus = document.getElementById('auth-status');
    const rawInput = document.getElementById('raw-input');
    const formatBtn = document.getElementById('format-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusMessage = document.getElementById('status-message');
    const queueList = document.getElementById('queue-list');
    const doneCount = document.getElementById('done-count');
    const errorCount = document.getElementById('error-count');
    const totalCount = document.getElementById('total-count');

    let formattedItems = [];

    function setStatus(message, type = '') {
        statusMessage.innerText = message;
        statusMessage.className = `status ${type}`.trim();
    }

    function showLogin() {
        loginPanel.classList.remove('hidden');
        toolContent.classList.add('hidden');
        authStatus.innerText = '';
    }

    function showTool(session) {
        loginPanel.classList.add('hidden');
        toolContent.classList.remove('hidden');
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

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function splitRawQuizzes(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return [];

        if (/\n\s*---+\s*\n/.test(text)) {
            return text.split(/\n\s*---+\s*\n/g).map(block => block.trim()).filter(Boolean);
        }

        const lines = text.split(/\r?\n/);
        const blocks = [];
        let current = [];

        lines.forEach(line => {
            const startsNewQuiz = /^t[ií]tulo\s*:/i.test(line.trim()) && current.some(item => item.trim());
            if (startsNewQuiz) {
                blocks.push(current.join('\n').trim());
                current = [];
            }
            current.push(line);
        });

        if (current.some(line => line.trim())) blocks.push(current.join('\n').trim());
        return blocks.filter(Boolean);
    }

    function getLabelValue(line) {
        const match = String(line || '').match(/^([^:]+):\s*(.*)$/);
        if (!match) return null;
        return { label: normalizeText(match[1]), value: match[2].trim() };
    }

    function normalizeQuizType(value) {
        const normalized = normalizeText(value).replace(/[_-]/g, ' ').trim();
        if (['verdadeiro falso', 'verdadeiro ou falso', 'true false', 'truefalse'].includes(normalized)) return 'verdadeiro_falso';
        if (['quem sou eu', 'who am i'].includes(normalized)) return 'quem_sou_eu';
        if (['trivia', 'conhecimento', 'multipla escolha', 'multiple choice'].includes(normalized)) return 'trivia';
        if (['associacao', 'association', 'associar', 'pares'].includes(normalized)) return 'associacao';
        return '';
    }

    function readBlockFields(block) {
        const lines = String(block || '').split(/\r?\n/);
        const fields = { title: '', description: '', type: '', itemsPerRound: '', body: [] };
        let currentField = '';
        let bodyStarted = false;
        const fieldByLabel = {
            titulo: 'title',
            'titulo seo': 'title',
            descricao: 'description',
            description: 'description',
            'meta description': 'description',
            tipo: 'type',
            modelo: 'type',
            'pares por rodada': 'itemsPerRound',
            'itens por rodada': 'itemsPerRound'
        };

        lines.forEach(rawLine => {
            const line = rawLine.trim();
            const labeled = getLabelValue(line);

            if (labeled) {
                if (['perguntas', 'conteudo', 'conteudo do quiz'].includes(labeled.label)) {
                    currentField = '';
                    bodyStarted = true;
                    if (labeled.value) fields.body.push(labeled.value);
                    return;
                }

                const field = fieldByLabel[labeled.label];
                if (field) {
                    currentField = field;
                    bodyStarted = false;
                    if (labeled.value) {
                        fields[field] = labeled.value;
                        currentField = '';
                    }
                    return;
                }
            }

            if (currentField && isQuestionStart(line)) {
                bodyStarted = true;
                currentField = '';
                fields.body.push(rawLine);
            } else if (bodyStarted || !currentField) {
                fields.body.push(rawLine);
            } else if (line) {
                fields[currentField] = fields[currentField] ? `${fields[currentField]}\n${line}` : line;
            }
        });

        if (!fields.title) {
            const firstLineIndex = lines.findIndex(line => line.trim());
            fields.title = firstLineIndex >= 0 ? lines[firstLineIndex].trim() : '';
            fields.body = firstLineIndex >= 0 ? lines.slice(firstLineIndex + 1) : [];
        }

        if (!fields.description) {
            const bodyLines = fields.body.map(line => line.trim()).filter(Boolean);
            const firstQuestionIndex = bodyLines.findIndex(isQuestionStart);
            const descriptionLines = firstQuestionIndex >= 0 ? bodyLines.slice(0, firstQuestionIndex) : bodyLines.slice(0, 1);
            fields.description = descriptionLines.join(' ').trim() || `Quiz sobre ${fields.title}.`;
            fields.body = firstQuestionIndex >= 0 ? bodyLines.slice(firstQuestionIndex) : bodyLines.slice(descriptionLines.length);
        }

        return fields;
    }

    function isQuestionStart(line) {
        const value = String(line || '').trim();
        return /^\d+[\.)]?$/.test(value)
            || /^\d+[\.)]\s+/.test(value)
            || /=>|->/.test(value)
            || ['verdadeiro', 'falso', 'true', 'false'].includes(normalizeText(value))
            || /^([A-Da-d]|[1-4])[\)\.\:-]\s+/.test(value)
            || /^resposta\s*:/i.test(value);
    }

    function splitQuestionBlocks(lines) {
        const blocks = [];
        let current = [];
        lines.map(line => String(line || '').trim()).filter(Boolean).forEach(line => {
            const numberOnly = line.match(/^\d+[\.)]?$/);
            const numberWithText = line.match(/^\d+[\.)]\s+(.+)$/);
            if (numberOnly || numberWithText) {
                if (current.length) blocks.push(current);
                current = [];
                if (numberWithText) current.push(numberWithText[1].trim());
                return;
            }
            current.push(line);
        });
        if (current.length) blocks.push(current);
        return blocks;
    }

    function inferQuizType(fields) {
        const explicit = normalizeQuizType(fields.type);
        if (explicit) return explicit;

        const sample = `${fields.title}\n${fields.body.join('\n')}`;
        if (/verdadeiro\s+ou\s+falso/i.test(sample) || /\b(verdadeiro|falso)\b/i.test(sample)) return 'verdadeiro_falso';
        if (/=>|->/.test(sample)) return 'associacao';
        if (/^resposta\s*:/im.test(sample) || /^([A-Da-d]|[1-4])[\)\.\:-]\s+/m.test(sample)) return 'quem_sou_eu';
        return 'verdadeiro_falso';
    }

    function formatTrueFalseQuestions(lines) {
        const blocks = splitQuestionBlocks(lines);
        const formatted = [];

        blocks.forEach((block, index) => {
            const answerIndex = block.findIndex(line => ['verdadeiro', 'true', 'falso', 'false'].includes(normalizeText(line.replace(/[✅❌✔✘]/g, ''))));
            const answer = answerIndex >= 0 ? block[answerIndex].replace(/[✅❌✔✘]/g, '').trim() : '';
            const questionLines = answerIndex >= 0 ? block.slice(0, answerIndex) : block.slice(0, 1);
            const explanation = answerIndex >= 0 ? block.slice(answerIndex + 1) : block.slice(1);
            formatted.push(`${index + 1}.\n${questionLines.join(' ').trim()}\n${answer || 'Resposta pendente'}${explanation.length ? `\n${explanation.join(' ')}` : ''}`);
        });

        return formatted;
    }

    function formatChoiceQuestions(lines) {
        const blocks = splitQuestionBlocks(lines);
        return blocks.map((block, index) => {
            const output = [];
            let answerCounter = 0;
            let hasCorrect = false;

            output.push(`${index + 1}.`);
            block.forEach(line => {
                const optionMatch = line.match(/^([A-Da-d]|[1-4])[\)\.\:-]\s*(.+)$/);
                const correctMatch = line.match(/^resposta\s*:\s*(.+)$/i);
                if (optionMatch) {
                    const letter = String.fromCharCode(65 + answerCounter);
                    output.push(`${letter}) ${optionMatch[2].trim()}`);
                    answerCounter++;
                    return;
                }
                if (correctMatch) {
                    output.push(`Resposta: ${correctMatch[1].trim()}`);
                    hasCorrect = true;
                    return;
                }
                output.push(line);
            });

            if (!hasCorrect) output.push('Resposta: PREENCHER');
            return output.join('\n');
        });
    }

    function formatAssociationQuestions(lines) {
        const blocks = splitQuestionBlocks(lines);
        return blocks.map((block, index) => {
            const joined = block.join(' ');
            const pairMatch = joined.match(/^(.+?)\s*(?:=>|->|=)\s*(.+)$/);
            if (pairMatch) return `${index + 1}.\n${pairMatch[1].trim()} => ${pairMatch[2].trim()}`;
            return `${index + 1}.\n${block[0] || 'Item'} => ${block[1] || 'Par pendente'}`;
        });
    }

    function formatOneQuiz(block) {
        const fields = readBlockFields(block);
        const type = inferQuizType(fields);
        const typeForImport = {
            verdadeiro_falso: 'verdadeiro_falso',
            quem_sou_eu: 'quem_sou_eu',
            trivia: 'trivia',
            associacao: 'associacao'
        }[type] || 'verdadeiro_falso';

        let questionBlocks = [];
        if (type === 'verdadeiro_falso') questionBlocks = formatTrueFalseQuestions(fields.body);
        if (type === 'quem_sou_eu' || type === 'trivia') questionBlocks = formatChoiceQuestions(fields.body);
        if (type === 'associacao') questionBlocks = formatAssociationQuestions(fields.body);

        const errors = [];
        if (!fields.title) errors.push('sem titulo');
        if (!questionBlocks.length) errors.push('sem perguntas');
        if (questionBlocks.some(question => /PREENCHER|pendente/i.test(question))) errors.push('precisa revisar respostas');

        const parts = [
            'Titulo:',
            fields.title || 'Titulo pendente',
            '',
            'Tipo:',
            typeForImport,
            '',
            'Descricao:',
            fields.description || `Quiz sobre ${fields.title}.`
        ];

        if (type === 'associacao') {
            parts.push('', 'Pares por rodada:', fields.itemsPerRound || '6');
        }

        parts.push('', 'Perguntas:', '', questionBlocks.join('\n\n'));
        return { title: fields.title || 'Sem titulo', type: typeForImport, output: parts.join('\n').trim(), errors };
    }

    function formatQueue() {
        const blocks = splitRawQuizzes(rawInput.value).slice(0, MAX_ITEMS);
        if (!blocks.length) {
            formattedItems = [];
            renderQueue();
            setStatus('Cole pelo menos um quiz cru para formatar.', 'error');
            return;
        }

        formattedItems = blocks.map(formatOneQuiz);
        renderQueue();
        const errors = formattedItems.filter(item => item.errors.length).length;
        if (errors) setStatus(`${formattedItems.length} quiz(es) formatado(s), mas ${errors} precisam de revisao.`, 'error');
        else setStatus(`${formattedItems.length} quiz(es) formatado(s) com sucesso.`, 'success');
    }

    function getAllFormatted() {
        return formattedItems.map(item => item.output).join('\n\n---\n\n');
    }

    async function copyText(text) {
        await navigator.clipboard.writeText(text);
    }

    function renderQueue() {
        const done = formattedItems.filter(item => !item.errors.length).length;
        const errors = formattedItems.filter(item => item.errors.length).length;
        doneCount.innerText = done;
        errorCount.innerText = errors;
        totalCount.innerText = formattedItems.length;
        copyAllBtn.disabled = formattedItems.length === 0;

        if (!formattedItems.length) {
            queueList.innerHTML = '<p class="queue-meta">Nenhum quiz formatado ainda.</p>';
            return;
        }

        queueList.innerHTML = formattedItems.map((item, index) => {
            const status = item.errors.length ? 'error' : 'done';
            return `
                <article class="queue-item is-${status}">
                    <div class="queue-header">
                        <div>
                            <div class="queue-title">Quiz ${index + 1}: ${escapeHTML(item.title)}</div>
                            <div class="queue-meta">Tipo: ${escapeHTML(item.type)}</div>
                        </div>
                        <span class="queue-badge ${status}">${item.errors.length ? 'Revisar' : 'Pronto'}</span>
                    </div>
                    ${item.errors.length ? `<p class="status error">${escapeHTML(item.errors.join(', '))}</p>` : ''}
                    <label for="formatted-${index}">Formatado:</label>
                    <textarea id="formatted-${index}" class="draft-output" readonly>${escapeHTML(item.output)}</textarea>
                    <div class="item-actions">
                        <button type="button" class="copy-btn" data-index="${index}">Copiar este quiz</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    formatBtn.addEventListener('click', formatQueue);
    clearBtn.addEventListener('click', () => {
        rawInput.value = '';
        formattedItems = [];
        renderQueue();
        setStatus('');
    });
    copyAllBtn.addEventListener('click', async () => {
        await copyText(getAllFormatted());
        setStatus('Tudo copiado com separadores automaticos. Agora e so colar no importador de quizzes.', 'success');
    });
    queueList.addEventListener('click', async event => {
        const button = event.target.closest('button[data-index]');
        if (!button) return;
        const item = formattedItems[Number(button.dataset.index)];
        if (!item) return;
        await copyText(item.output);
        setStatus('Quiz copiado.', 'success');
    });
    loginForm.addEventListener('submit', handleLogin);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session) showTool(session);
        else showLogin();
    });

    supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) showTool(data.session);
        else showLogin();
    });
});
