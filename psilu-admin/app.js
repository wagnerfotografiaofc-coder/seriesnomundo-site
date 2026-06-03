const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MODELS = [
    { id: 'deepseek-flash', label: 'DeepSeek Flash', family: 'deepseek', inputPrice: 0.14, outputPrice: 0.28, maxOutput: 2500 },
    { id: 'deepseek-pro', label: 'DeepSeek Pro', family: 'deepseek', inputPrice: 0.435, outputPrice: 0.87, maxOutput: 2500 },
    { id: 'claude-haiku', label: 'Claude Haiku', family: 'claude', inputPrice: 1, outputPrice: 5, maxOutput: 1500 },
    { id: 'claude-sonnet', label: 'Claude Sonnet', family: 'claude', inputPrice: 3, outputPrice: 15, maxOutput: 1500 },
    { id: 'claude-opus', label: 'Claude Opus', family: 'claude', inputPrice: 5, outputPrice: 25, maxOutput: 1500 }
];

const DAILY_PHRASES = [
    'Vamos construir a empresa que ainda nao existe.',
    'Hoje e dia de transformar clareza em movimento.',
    'Menos barulho, mais decisao.',
    'A Psilu cresce quando o foco vira rotina.',
    'Um bom dia de trabalho muda a semana inteira.',
    'A estrategia aparece quando os dados param de ficar soltos.'
];

const state = {
    user: null,
    activeView: 'home',
    activeModal: null,
    editingId: null,
    currentChatId: null,
    context: [],
    entities: {
        tasks: [],
        events: [],
        editorial: [],
        docs: [],
        strategies: [],
        messages: []
    }
};

const tables = {
    tasks: 'psilu_tasks',
    events: 'psilu_calendar_events',
    editorial: 'psilu_editorial_items',
    docs: 'psilu_docs',
    strategies: 'psilu_strategies',
    chats: 'psilu_ai_chats',
    messages: 'psilu_ai_messages'
};

const modalConfigs = {
    task: {
        title: 'Tarefa',
        table: 'tasks',
        fields: [
            ['title', 'Titulo', 'text', true],
            ['description', 'Descricao', 'textarea', false],
            ['status', 'Status', 'select:a_fazer|fazendo|aguardando|concluido', true],
            ['priority', 'Prioridade', 'select:baixa|media|alta', true],
            ['due_at', 'Data/prazo', 'datetime-local', false],
            ['origin', 'Origem', 'select:manual|ia|reuniao|produto|marketing|vendas', true]
        ],
        defaults: { status: 'a_fazer', priority: 'media', origin: 'manual' }
    },
    event: {
        title: 'Evento',
        table: 'events',
        fields: [
            ['title', 'Titulo', 'text', true],
            ['description', 'Descricao', 'textarea', false],
            ['starts_at', 'Inicio', 'datetime-local', true],
            ['ends_at', 'Fim', 'datetime-local', false],
            ['event_type', 'Tipo', 'select:reuniao|entrega|lembrete|operacao', true]
        ],
        defaults: { event_type: 'operacao' }
    },
    editorial: {
        title: 'Item editorial',
        table: 'editorial',
        fields: [
            ['title', 'Titulo', 'text', true],
            ['channel', 'Canal', 'select:Instagram|TikTok|Email|WhatsApp|Blog|Outro', true],
            ['status', 'Status', 'select:ideia|planejado|em_producao|publicado|pausado', true],
            ['publish_at', 'Data', 'datetime-local', false],
            ['summary', 'Descricao/copy', 'textarea', false],
            ['notes', 'Observacoes', 'textarea', false]
        ],
        defaults: { channel: 'Instagram', status: 'ideia' }
    },
    doc: {
        title: 'Documento',
        table: 'docs',
        fields: [
            ['title', 'Titulo', 'text', true],
            ['category', 'Categoria', 'select:ICP|Concorrentes|Instagram|Produto|Vendas|Analises|Outro', true],
            ['tags', 'Tags', 'text', false],
            ['content', 'Conteudo', 'textarea', false]
        ],
        defaults: { category: 'ICP' }
    },
    strategy: {
        title: 'Estrategia',
        table: 'strategies',
        fields: [
            ['title', 'Titulo', 'text', true],
            ['category', 'Categoria', 'select:Marketing|Vendas|Produto|Conteudo|Operacao|Outro', true],
            ['description', 'Descricao livre', 'textarea', false],
            ['notes', 'Aprendizados', 'textarea', false]
        ],
        defaults: { category: 'Marketing' }
    }
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
    bindElements();
    bindEvents();
    renderModelOptions();
    renderDateHeader();
    startAuth();
});

function bindElements() {
    [
        'login-shell', 'app-shell', 'login-form', 'login-email', 'login-password', 'login-message',
        'auth-status', 'logout-btn', 'date-label', 'page-title', 'daily-phrase', 'home-task-list',
        'home-calendar-list', 'home-editorial-list', 'tasks-kanban', 'calendar-board',
        'editorial-list', 'docs-grid', 'strategies-grid', 'model-select', 'new-chat-btn',
        'briefing-btn', 'context-chip-row', 'chat-thread', 'chat-form', 'chat-input',
        'entity-modal', 'entity-form', 'modal-title', 'modal-fields', 'modal-close-btn',
        'cancel-entity-btn', 'delete-entity-btn'
    ].forEach(id => {
        els[toCamel(id)] = document.getElementById(id);
    });
}

function bindEvents() {
    els.loginForm.addEventListener('submit', login);
    els.logoutBtn.addEventListener('click', () => supabaseClient.auth.signOut());
    els.newChatBtn.addEventListener('click', createChat);
    els.briefingBtn.addEventListener('click', prepareBriefing);
    els.chatForm.addEventListener('submit', sendChatMessage);
    els.entityForm.addEventListener('submit', saveEntity);
    els.modalCloseBtn.addEventListener('click', closeModal);
    els.cancelEntityBtn.addEventListener('click', closeModal);
    els.deleteEntityBtn.addEventListener('click', deleteEntity);

    document.querySelectorAll('[data-nav]').forEach(button => {
        button.addEventListener('click', () => setView(button.dataset.nav));
    });

    document.querySelectorAll('[data-open-modal]').forEach(button => {
        button.addEventListener('click', () => openModal(button.dataset.openModal));
    });

    document.querySelectorAll('[data-context]').forEach(button => {
        button.addEventListener('click', () => addContext(button.dataset.context));
    });
}

async function startAuth() {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        handleSession(session);
    });
    const { data } = await supabaseClient.auth.getSession();
    handleSession(data.session);
}

async function handleSession(session) {
    state.user = session?.user || null;
    els.loginShell.classList.toggle('hidden', !!state.user);
    els.appShell.classList.toggle('hidden', !state.user);
    els.authStatus.textContent = state.user?.email || '';

    if (state.user) {
        await loadAll();
        await createChat();
    }
}

async function login(event) {
    event.preventDefault();
    els.loginMessage.textContent = '';
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: els.loginEmail.value,
        password: els.loginPassword.value
    });
    if (error) els.loginMessage.textContent = error.message;
}

async function loadAll() {
    await Promise.all([
        loadTable('tasks', { column: 'created_at', ascending: false }),
        loadTable('events', { column: 'starts_at', ascending: true }),
        loadTable('editorial', { column: 'publish_at', ascending: true }),
        loadTable('docs', { column: 'updated_at', ascending: false }),
        loadTable('strategies', { column: 'updated_at', ascending: false })
    ]);
    renderAll();
}

async function loadTable(key, order) {
    const { data, error } = await supabaseClient
        .from(tables[key])
        .select('*')
        .order(order.column, { ascending: order.ascending });

    if (error) {
        state.entities[key] = [];
        addSystemMessage(`Tabela ${tables[key]} ainda nao esta pronta. Rode o SQL do Supabase para ativar este modulo.`);
        return;
    }
    state.entities[key] = data || [];
}

function renderAll() {
    renderDateHeader();
    renderHome();
    renderTasks();
    renderCalendar();
    renderEditorial();
    renderDocs();
    renderStrategies();
    renderContextChips();
}

function renderDateHeader() {
    const now = new Date();
    els.dateLabel.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    els.pageTitle.textContent = getGreeting(now);
    els.dailyPhrase.textContent = getDailyPhrase();
}

function getGreeting(now) {
    const hour = now.getHours();
    if (hour < 12) return 'Bom dia, Bruno';
    if (hour < 18) return 'Boa tarde, Bruno';
    return 'Boa noite, Bruno';
}

function getDailyPhrase() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const seed = Array.from(todayKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return DAILY_PHRASES[seed % DAILY_PHRASES.length];
}

function renderHome() {
    const nextTasks = state.entities.tasks
        .filter(task => task.status !== 'concluido')
        .sort((a, b) => dateValue(a.due_at) - dateValue(b.due_at))
        .slice(0, 3);

    els.homeTaskList.innerHTML = nextTasks.length ? nextTasks.map(task => `
        <div class="task-preview">
            <strong>${escapeHTML(task.title)}</strong>
            <span class="meta">${formatDate(task.due_at) || 'Sem prazo'} · ${escapeHTML(task.priority || 'media')}</span>
            <div class="pill-row">
                <span class="pill">${formatStatus(task.status)}</span>
                <button type="button" class="ghost-btn" data-complete-task="${task.id}">Concluir</button>
            </div>
        </div>
    `).join('') : '<p class="empty-state">Nenhuma tarefa pendente por enquanto.</p>';

    els.homeTaskList.querySelectorAll('[data-complete-task]').forEach(button => {
        button.addEventListener('click', () => completeTask(button.dataset.completeTask));
    });

    els.homeCalendarList.innerHTML = renderCompactList(state.entities.events.slice(0, 5), 'starts_at');
    els.homeEditorialList.innerHTML = renderCompactList(state.entities.editorial.slice(0, 5), 'publish_at');
}

function renderCompactList(items, dateField) {
    if (!items.length) return '<p class="empty-state">Nada cadastrado ainda.</p>';
    return items.map(item => `
        <div class="compact-item">
            <h3>${escapeHTML(item.title)}</h3>
            <p class="meta">${formatDate(item[dateField]) || 'Sem data'}</p>
        </div>
    `).join('');
}

function renderTasks() {
    const columns = [
        ['a_fazer', 'A fazer'],
        ['fazendo', 'Fazendo'],
        ['aguardando', 'Aguardando'],
        ['concluido', 'Concluido']
    ];

    els.tasksKanban.innerHTML = columns.map(([status, label]) => {
        const tasks = state.entities.tasks.filter(task => task.status === status);
        return `
            <section class="kanban-column">
                <h3>${label}</h3>
                ${tasks.length ? tasks.map(task => `
                    <button type="button" class="kanban-card" data-edit="task" data-id="${task.id}">
                        <strong>${escapeHTML(task.title)}</strong>
                        <span class="meta">${formatDate(task.due_at) || 'Sem prazo'}</span>
                        <span class="pill priority-${escapeHTML(task.priority || 'media')}">${escapeHTML(task.priority || 'media')}</span>
                    </button>
                `).join('') : '<p class="empty-state">Vazio.</p>'}
            </section>
        `;
    }).join('');

    bindEditButtons(els.tasksKanban);
}

function renderCalendar() {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const days = [];

    for (let day = 1; day <= last.getDate(); day += 1) {
        const date = new Date(first.getFullYear(), first.getMonth(), day);
        const iso = date.toISOString().slice(0, 10);
        const events = state.entities.events.filter(event => String(event.starts_at || '').slice(0, 10) === iso);
        days.push(`
            <article class="day-cell">
                <div class="day-number">${day}</div>
                ${events.map(event => `<div class="calendar-chip">${escapeHTML(event.title)}</div>`).join('')}
            </article>
        `);
    }

    els.calendarBoard.innerHTML = days.join('');
}

function renderEditorial() {
    els.editorialList.innerHTML = state.entities.editorial.length ? state.entities.editorial.map(item => `
        <button type="button" class="item-row" data-edit="editorial" data-id="${item.id}">
            <span class="meta">${formatDate(item.publish_at) || 'Sem data'}</span>
            <div>
                <h3>${escapeHTML(item.title)}</h3>
                <p class="meta">${escapeHTML(item.channel || 'Canal')} · ${escapeHTML(item.status || 'ideia')}</p>
            </div>
            <span class="pill">${escapeHTML(item.channel || 'Outro')}</span>
        </button>
    `).join('') : '<p class="empty-state">Nenhum item editorial ainda.</p>';
    bindEditButtons(els.editorialList);
}

function renderDocs() {
    els.docsGrid.innerHTML = state.entities.docs.length ? state.entities.docs.map(doc => `
        <button type="button" class="notion-card" data-edit="doc" data-id="${doc.id}">
            <span class="pill">${escapeHTML(doc.category || 'Doc')}</span>
            <h3>${escapeHTML(doc.title)}</h3>
            <p class="meta">${truncate(doc.content || 'Sem conteudo ainda.', 120)}</p>
        </button>
    `).join('') : '<p class="empty-state">Nenhum documento ainda.</p>';
    bindEditButtons(els.docsGrid);
}

function renderStrategies() {
    els.strategiesGrid.innerHTML = state.entities.strategies.length ? state.entities.strategies.map(strategy => `
        <button type="button" class="notion-card" data-edit="strategy" data-id="${strategy.id}">
            <span class="pill">${escapeHTML(strategy.category || 'Estrategia')}</span>
            <h3>${escapeHTML(strategy.title)}</h3>
            <p class="meta">${truncate(strategy.description || 'Sem descricao ainda.', 120)}</p>
        </button>
    `).join('') : '<p class="empty-state">Nenhuma estrategia ainda.</p>';
    bindEditButtons(els.strategiesGrid);
}

function bindEditButtons(container) {
    container.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => openModal(button.dataset.edit, button.dataset.id));
    });
}

function setView(view) {
    state.activeView = view;
    document.querySelectorAll('.view').forEach(section => {
        section.classList.toggle('active', section.dataset.view === view);
    });
    document.querySelectorAll('[data-nav]').forEach(button => {
        button.classList.toggle('active', button.dataset.nav === view);
    });
}

function openModal(type, id = null) {
    const config = modalConfigs[type];
    state.activeModal = type;
    state.editingId = id;
    const item = id ? state.entities[config.table].find(entity => String(entity.id) === String(id)) : config.defaults;

    els.modalTitle.textContent = `${id ? 'Editar' : 'Novo'} ${config.title.toLowerCase()}`;
    els.deleteEntityBtn.classList.toggle('hidden', !id);
    els.modalFields.innerHTML = config.fields.map(([name, label, inputType, required]) => {
        const value = item?.[name] || '';
        return renderField(name, label, inputType, required, value);
    }).join('');
    els.entityModal.showModal();
}

function renderField(name, label, inputType, required, value) {
    const requiredAttr = required ? 'required' : '';
    if (inputType === 'textarea') {
        return `<label>${label}<textarea name="${name}" rows="6" ${requiredAttr}>${escapeHTML(value)}</textarea></label>`;
    }
    if (inputType.startsWith('select:')) {
        const options = inputType.replace('select:', '').split('|');
        return `<label>${label}<select name="${name}" ${requiredAttr}>${options.map(option => `
            <option value="${escapeHTML(option)}" ${option === value ? 'selected' : ''}>${escapeHTML(formatStatus(option))}</option>
        `).join('')}</select></label>`;
    }
    return `<label>${label}<input name="${name}" type="${inputType}" value="${escapeHTML(toInputDate(value, inputType))}" ${requiredAttr}></label>`;
}

function closeModal() {
    els.entityModal.close();
    state.activeModal = null;
    state.editingId = null;
}

async function saveEntity(event) {
    event.preventDefault();
    const config = modalConfigs[state.activeModal];
    const payload = Object.fromEntries(new FormData(els.entityForm).entries());
    normalizeDateTimeFields(payload, config);
    payload.updated_at = new Date().toISOString();

    const query = supabaseClient.from(tables[config.table]);
    const response = state.editingId
        ? await query.update(payload).eq('id', state.editingId).select().single()
        : await query.insert({ ...payload, created_by: state.user.id }).select().single();

    if (response.error) {
        addSystemMessage(response.error.message);
        return;
    }

    closeModal();
    await loadTable(config.table, defaultOrder(config.table));
    renderAll();
}

function normalizeDateTimeFields(payload, config) {
    config.fields.forEach(([name, _label, inputType]) => {
        if (inputType !== 'datetime-local' || !payload[name]) return;
        const date = new Date(payload[name]);
        payload[name] = Number.isNaN(date.getTime()) ? null : date.toISOString();
    });
}

async function deleteEntity() {
    const config = modalConfigs[state.activeModal];
    if (!state.editingId) return;
    const { error } = await supabaseClient.from(tables[config.table]).delete().eq('id', state.editingId);
    if (error) {
        addSystemMessage(error.message);
        return;
    }
    closeModal();
    await loadTable(config.table, defaultOrder(config.table));
    renderAll();
}

async function completeTask(id) {
    const { error } = await supabaseClient.from(tables.tasks).update({ status: 'concluido', completed_at: new Date().toISOString() }).eq('id', id);
    if (error) {
        addSystemMessage(error.message);
        return;
    }
    await loadTable('tasks', defaultOrder('tasks'));
    renderAll();
}

async function createChat() {
    state.context = [];
    state.currentChatId = null;
    state.entities.messages = [];
    els.chatThread.innerHTML = '';
    renderContextChips();

    const { data, error } = await supabaseClient
        .from(tables.chats)
        .insert({ title: 'Novo chat', created_by: state.user.id, model_id: els.modelSelect.value || MODELS[0].id })
        .select()
        .single();

    if (error) {
        addSystemMessage('Chat local iniciado. Rode o SQL para salvar historico por 10 dias.');
        return;
    }

    state.currentChatId = data.id;
    addSystemMessage('Novo chat iniciado. Anexe contexto quando quiser que a IA leia dados do painel.');
}

async function sendChatMessage(event) {
    event.preventDefault();
    const text = els.chatInput.value.trim();
    if (!text) return;

    const model = MODELS.find(item => item.id === els.modelSelect.value) || MODELS[0];
    els.chatInput.value = '';
    addChatBubble('user', text);
    await saveMessage('user', text, model);

    const payload = {
        chatId: state.currentChatId,
        modelId: model.id,
        message: text,
        context: state.context,
        maxOutputTokens: model.family === 'claude' ? 1500 : model.maxOutput
    };

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const response = await fetch('/api/psilu-ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionData.session?.access_token || ''}`
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao chamar IA.');

        addChatBubble('assistant', result.text, result.usage, result.suggestedActions);
        await saveMessage('assistant', result.text, model, result.usage);
    } catch (error) {
        addChatBubble('assistant', `Ainda nao consegui falar com a IA: ${error.message}`);
    }
}

async function saveMessage(role, content, model, usage = null) {
    if (!state.currentChatId) return;
    await supabaseClient.from(tables.messages).insert({
        chat_id: state.currentChatId,
        role,
        content,
        model_id: model.id,
        input_tokens: usage?.inputTokens || 0,
        output_tokens: usage?.outputTokens || 0,
        estimated_cost: usage?.estimatedCost || 0
    });
}

function addChatBubble(role, text, usage = null, suggestedActions = []) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role}`;
    bubble.innerHTML = `<div>${escapeHTML(text)}</div>${usage ? renderUsage(usage) : ''}${renderSuggestedActions(suggestedActions)}`;
    els.chatThread.appendChild(bubble);
    els.chatThread.scrollTop = els.chatThread.scrollHeight;
}

function addSystemMessage(text) {
    if (!els.chatThread) return;
    addChatBubble('system', text);
}

function renderUsage(usage) {
    return `<p class="cost-line">Entrada: ${usage.inputTokens || 0} tokens · Saida: ${usage.outputTokens || 0} tokens · Custo estimado: US$${Number(usage.estimatedCost || 0).toFixed(4)}</p>`;
}

function renderSuggestedActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return '';
    return `<div class="suggested-actions">${actions.map(action => `
        <div class="suggested-action">
            <strong>${escapeHTML(action.title || 'Acao sugerida')}</strong>
            <p class="meta">${escapeHTML(action.description || '')}</p>
            <button type="button" class="ghost-btn" disabled>Aprovar depois</button>
        </div>
    `).join('')}</div>`;
}

async function addContext(type) {
    const labelMap = {
        today: 'Hoje',
        tasks: 'Tarefas',
        calendar: 'Calendario',
        editorial: 'Editorial',
        docs: 'Docs',
        strategies: 'Estrategias'
    };
    if (!state.context.some(item => item.type === type)) {
        state.context.push({ type, label: labelMap[type], data: getContextData(type) });
    }
    renderContextChips();
}

async function prepareBriefing() {
    const previousContext = [...state.context];
    ['today', 'tasks', 'calendar', 'editorial', 'docs', 'strategies'].forEach(type => {
        if (!state.context.some(item => item.type === type)) {
            state.context.push({ type, label: type, data: getContextData(type) });
        }
    });
    renderContextChips();
    addChatBubble('system', 'Briefing CMO preparado com resumo do dia, tarefas, calendarios, docs e estrategias. Escolha Sonnet ou Opus e envie sua pergunta.');
    if (!previousContext.length) return;
}

function getContextData(type) {
    if (type === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        return {
            tasks: state.entities.tasks.filter(item => String(item.due_at || '').slice(0, 10) === today),
            events: state.entities.events.filter(item => String(item.starts_at || '').slice(0, 10) === today),
            editorial: state.entities.editorial.filter(item => String(item.publish_at || '').slice(0, 10) === today)
        };
    }
    if (type === 'calendar') return state.entities.events;
    return state.entities[type] || [];
}

function renderContextChips() {
    els.contextChipRow.innerHTML = state.context.map(item => `<span class="context-chip">${escapeHTML(item.label)}</span>`).join('');
}

function renderModelOptions() {
    els.modelSelect.innerHTML = MODELS.map(model => `<option value="${model.id}">${model.label}</option>`).join('');
}

function defaultOrder(key) {
    const orderMap = {
        tasks: { column: 'created_at', ascending: false },
        events: { column: 'starts_at', ascending: true },
        editorial: { column: 'publish_at', ascending: true },
        docs: { column: 'updated_at', ascending: false },
        strategies: { column: 'updated_at', ascending: false }
    };
    return orderMap[key];
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

function toCamel(value) {
    return value.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function formatStatus(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dateValue(value) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function toInputDate(value, inputType) {
    if (!value || inputType !== 'datetime-local') return value || '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function truncate(value, maxLength) {
    const text = String(value || '');
    return text.length > maxLength ? `${escapeHTML(text.slice(0, maxLength))}...` : escapeHTML(text);
}
