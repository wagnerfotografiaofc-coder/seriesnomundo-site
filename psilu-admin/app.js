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

const CHAT_STORAGE_PREFIX = 'psilu-active-chat';

const state = {
    user: null,
    loadedUserId: null,
    activeView: 'home',
    activeModal: null,
    editingId: null,
    currentChatId: null,
    context: [],
    pendingActions: {},
    reviewingActionId: null,
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
    messages: 'psilu_ai_messages',
    actions: 'psilu_ai_suggested_actions'
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
        'model-menu-btn', 'model-menu', 'model-current-label', 'briefing-btn', 'context-chip-row', 'chat-thread', 'chat-form', 'chat-input',
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
    els.modelMenuBtn.addEventListener('click', toggleModelMenu);
    els.modelSelect.addEventListener('change', updateModelCurrentLabel);
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

    document.addEventListener('click', event => {
        if (!event.target.closest('.model-picker')) closeModelMenu();
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

    if (!state.user) {
        state.loadedUserId = null;
        return;
    }

    if (state.loadedUserId === state.user.id) return;
    state.loadedUserId = state.user.id;

    await loadAll();
    await restoreChat();
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
    const todayKey = localDateKey(new Date());
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
            <span class="meta">${formatDate(task.due_at) || 'Sem prazo'} - ${escapeHTML(task.priority || 'media')}</span>
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
    const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
    const days = [];
    const leadingEmptyDays = (first.getDay() + 6) % 7;

    weekdays.forEach(weekday => {
        days.push(`<div class="calendar-weekday">${weekday}</div>`);
    });

    for (let index = 0; index < leadingEmptyDays; index += 1) {
        days.push('<article class="day-cell empty"></article>');
    }

    for (let day = 1; day <= last.getDate(); day += 1) {
        const date = new Date(first.getFullYear(), first.getMonth(), day);
        const dayKey = localDateKey(date);
        const events = state.entities.events.filter(event => localDateKey(event.starts_at) === dayKey);
        const isToday = localDateKey(today) === dayKey;
        days.push(`
            <article class="day-cell ${isToday ? 'today' : ''}">
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
                <p class="meta">${escapeHTML(item.channel || 'Canal')} - ${escapeHTML(item.status || 'ideia')}</p>
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

function openModal(type, id = null, seed = null) {
    const config = modalConfigs[type];
    state.activeModal = type;
    state.editingId = id;
    const existingItem = id ? state.entities[config.table].find(entity => String(entity.id) === String(id)) : null;
    const item = existingItem
        ? { ...existingItem, ...(seed || {}) }
        : { ...config.defaults, ...(seed || {}) };

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
    state.reviewingActionId = null;
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

    const reviewedAction = state.pendingActions[state.reviewingActionId];
    if (reviewedAction) await markSuggestedActionDone(reviewedAction);
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
    state.pendingActions = {};
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
    setStoredChatId(data.id);
    addSystemMessage('Novo chat iniciado. Anexe contexto quando quiser que a IA leia dados do painel.');
}

async function restoreChat() {
    state.context = [];
    state.pendingActions = {};
    els.chatThread.innerHTML = '';
    renderContextChips();

    const storedChatId = getStoredChatId();
    if (storedChatId && await loadChat(storedChatId)) return;

    const { data: latestChat } = await supabaseClient
        .from(tables.chats)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestChat?.id && await loadChat(latestChat.id)) return;

    await createChat();
}

async function loadChat(chatId) {
    const { data: chat, error: chatError } = await supabaseClient
        .from(tables.chats)
        .select('*')
        .eq('id', chatId)
        .maybeSingle();

    if (chatError || !chat) return false;

    const { data: messages, error: messagesError } = await supabaseClient
        .from(tables.messages)
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

    if (messagesError) return false;

    state.currentChatId = chat.id;
    state.entities.messages = messages || [];
    setStoredChatId(chat.id);
    els.chatThread.innerHTML = '';
    state.entities.messages.forEach(message => {
        addChatBubble(message.role, message.content, message.role === 'assistant' ? {
            inputTokens: message.input_tokens,
            outputTokens: message.output_tokens,
            estimatedCost: message.estimated_cost
        } : null, [], { persist: false });
    });
    await renderPendingActionsForChat(chat.id);
    if (!state.entities.messages.length) {
        addSystemMessage('Chat restaurado. Anexe contexto quando quiser que a IA leia dados do painel.');
    }
    return true;
}

async function sendChatMessage(event) {
    event.preventDefault();
    const text = els.chatInput.value.trim();
    if (!text) return;

    const model = MODELS.find(item => item.id === els.modelSelect.value) || MODELS[0];
    const isClaudeModel = model.family === 'claude';
    els.chatInput.value = '';
    addChatBubble('user', text);
    await saveMessage('user', text, model);

    if (!isClaudeModel) {
        await loadAll();
        const inferredContexts = addContextFromMessage(text);
        if (inferredContexts.length) {
            addChatBubble('system', `Contexto anexado automaticamente: ${inferredContexts.join(', ')}.`);
        }
        refreshAttachedContext();
    }

    const payload = {
        chatId: state.currentChatId,
        modelId: model.id,
        message: text,
        context: isClaudeModel ? [] : buildAiContextPayload(text),
        history: buildRecentChatHistory(isClaudeModel ? 2400 : 600),
        clientMeta: getClientMeta(),
        maxOutputTokens: isClaudeModel ? 1500 : model.maxOutput
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
        const savedMessage = await saveMessage('assistant', result.text, model, result.usage);
        await saveSuggestedActions(savedMessage?.id, result.suggestedActions || []);
    } catch (error) {
        addChatBubble('assistant', `Ainda nao consegui falar com a IA: ${error.message}`);
    }
}

async function saveMessage(role, content, model, usage = null) {
    if (!state.currentChatId) return;
    const { data } = await supabaseClient.from(tables.messages).insert({
        chat_id: state.currentChatId,
        role,
        content,
        model_id: model.id,
        input_tokens: usage?.inputTokens || 0,
        output_tokens: usage?.outputTokens || 0,
        estimated_cost: usage?.estimatedCost || 0
    }).select().single();
    await updateChatActivity();
    return data;
}

async function saveSuggestedActions(messageId, actions) {
    if (!state.currentChatId || !messageId || !Array.isArray(actions) || !actions.length) return;
    const rows = actions.map(action => ({
        chat_id: state.currentChatId,
        message_id: messageId,
        action_type: `${action.operation || 'create'}_${action.type || action.action_type || 'note'}`,
        title: action.title || 'Acao sugerida',
        payload: { ...(action.payload || {}), sourceMessage: action.sourceMessage || '', localId: action.localId || '' },
        status: 'pending'
    }));
    const { data } = await supabaseClient.from(tables.actions).insert(rows).select();
    (data || []).forEach(row => {
        const localId = row.payload?.localId;
        if (localId && state.pendingActions[localId]) {
            state.pendingActions[localId].dbId = row.id;
        }
    });
}

async function renderPendingActionsForChat(chatId) {
    const { data } = await supabaseClient
        .from(tables.actions)
        .select('*')
        .eq('chat_id', chatId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (!Array.isArray(data) || !data.length) return;

    const actions = data.map(row => {
        const [operation, ...typeParts] = String(row.action_type || 'create_note').split('_');
        return {
            type: typeParts.join('_') || 'note',
            operation: operation || 'create',
            title: row.title,
            description: 'Acao pendente salva neste chat.',
            payload: row.payload || {},
            sourceMessage: row.payload?.sourceMessage || '',
            dbId: row.id
        };
    });
    addChatBubble('system', 'Acoes pendentes deste chat:', null, actions, { persist: false });
}

async function updateChatActivity() {
    if (!state.currentChatId) return;
    await supabaseClient
        .from(tables.chats)
        .update({ updated_at: new Date().toISOString(), model_id: els.modelSelect.value || MODELS[0].id })
        .eq('id', state.currentChatId);
}

function getStoredChatId() {
    if (!state.user) return '';
    return localStorage.getItem(`${CHAT_STORAGE_PREFIX}:${state.user.id}`) || '';
}

function setStoredChatId(chatId) {
    if (!state.user || !chatId) return;
    localStorage.setItem(`${CHAT_STORAGE_PREFIX}:${state.user.id}`, chatId);
}

function addChatBubble(role, text, usage = null, suggestedActions = [], options = {}) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role}`;
    const actions = rememberSuggestedActions(suggestedActions);
    bubble.innerHTML = `<div>${escapeHTML(text)}</div>${usage ? renderUsage(usage) : ''}${renderSuggestedActions(actions)}`;
    els.chatThread.appendChild(bubble);
    bindSuggestedActionButtons(bubble);
    els.chatThread.scrollTop = els.chatThread.scrollHeight;
    if (options.persist !== false && role !== 'system') {
        state.entities.messages.push({ role, content: text, created_at: new Date().toISOString() });
    }
}

function addSystemMessage(text) {
    if (!els.chatThread) return;
    addChatBubble('system', text);
}

function renderUsage(usage) {
    return `<p class="cost-line">Entrada: ${usage.inputTokens || 0} tokens - Saida: ${usage.outputTokens || 0} tokens - Custo estimado: US$${Number(usage.estimatedCost || 0).toFixed(4)}</p>`;
}

function renderSuggestedActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return '';
    return `<div class="suggested-actions">${actions.map(action => `
        <div class="suggested-action">
            <strong>${escapeHTML(action.title || 'Acao sugerida')}</strong>
            <p class="meta">${escapeHTML(action.description || '')}</p>
            <button type="button" class="ghost-btn" data-review-action="${escapeHTML(action.localId)}">Revisar e aprovar</button>
        </div>
    `).join('')}</div>`;
}

function rememberSuggestedActions(actions) {
    if (!Array.isArray(actions)) return [];
    return actions.map(action => {
        const localId = `action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const storedAction = { ...action, localId };
        state.pendingActions[localId] = storedAction;
        return storedAction;
    });
}

function bindSuggestedActionButtons(container) {
    container.querySelectorAll('[data-review-action]').forEach(button => {
        button.addEventListener('click', () => reviewSuggestedAction(button.dataset.reviewAction));
    });
}

function reviewSuggestedAction(actionId) {
    const action = state.pendingActions[actionId];
    if (!action) return;

    const modalType = modalTypeForAction(action);
    if (!modalType) {
        addChatBubble('system', 'Essa sugestao ainda nao tem formulario automatico. Copie o texto e crie manualmente.');
        return;
    }

    const operation = action.operation || action.payload?.operation || 'create';
    if (operation === 'complete') {
        completeSuggestedEntity(action, modalType);
        return;
    }
    if (operation === 'delete') {
        deleteSuggestedEntity(action, modalType);
        return;
    }

    if (['update', 'edit'].includes(operation)) {
        const target = findTargetEntity(action, modalType);
        if (!target) {
            addChatBubble('system', 'Nao encontrei o item para editar. Abra o item manualmente ou peca com o titulo exato.');
            return;
        }
        state.reviewingActionId = actionId;
        openModal(modalType, target.id, payloadForSuggestedAction(action, modalType));
        return;
    }

    state.reviewingActionId = actionId;
    openModal(modalType, null, payloadForSuggestedAction(action, modalType));
}

function modalTypeForAction(action) {
    const type = String(action.type || action.action_type || '').replace(/^create_/, '');
    if (['task', 'event', 'editorial', 'doc', 'strategy'].includes(type)) return type;
    if (type === 'calendar') return 'event';
    if (type === 'document') return 'doc';
    return null;
}

function payloadForSuggestedAction(action, modalType) {
    const payload = { ...(action.payload || {}) };
    const inferredDate = inferDateTimeFromText(action.sourceMessage || payload.sourceMessage || action.description || action.title || '');
    const operation = action.operation || payload.operation || 'create';

    if (['update', 'edit'].includes(operation)) {
        const target = findTargetEntity(action, modalType);
        if (!target) return payload;
        return { ...target, ...(payload.updates || payload) };
    }

    if (modalType === 'task') {
        return {
            title: payload.title || action.title || 'Tarefa sugerida',
            description: payload.description || action.description || '',
            status: payload.status || 'a_fazer',
            priority: payload.priority || 'media',
            due_at: inferredDate || payload.due_at || '',
            origin: 'ia'
        };
    }

    if (modalType === 'event') {
        return {
            title: payload.title || action.title || 'Evento sugerido',
            description: payload.description || action.description || '',
            starts_at: inferredDate || payload.starts_at || '',
            ends_at: payload.ends_at || '',
            event_type: payload.event_type || 'operacao'
        };
    }

    if (modalType === 'editorial') {
        return {
            title: payload.title || action.title || 'Item editorial sugerido',
            channel: payload.channel || 'Instagram',
            status: payload.status || 'ideia',
            publish_at: inferredDate || payload.publish_at || '',
            summary: payload.summary || action.description || '',
            notes: payload.notes || ''
        };
    }

    if (modalType === 'doc') {
        return {
            title: payload.title || action.title || 'Documento sugerido',
            category: payload.category || 'Outro',
            tags: payload.tags || '',
            content: payload.content || action.description || ''
        };
    }

    return {
        title: payload.title || action.title || 'Estrategia sugerida',
        category: payload.category || 'Marketing',
        description: payload.description || action.description || '',
        notes: payload.notes || ''
    };
}

function findTargetEntity(action, modalType) {
    const config = modalConfigs[modalType];
    if (!config) return null;
    const payload = action.payload || {};
    const list = state.entities[config.table] || [];

    if (payload.target_id) {
        const byId = list.find(item => String(item.id) === String(payload.target_id));
        if (byId) return byId;
    }

    const targetTitle = normalizeForSearch(payload.target_title || payload.title || action.target_title || action.title || '');
    if (!targetTitle) return null;

    return list.find(item => normalizeForSearch(item.title) === targetTitle)
        || list.find(item => normalizeForSearch(item.title).includes(targetTitle))
        || list.find(item => targetTitle.includes(normalizeForSearch(item.title)));
}

async function completeSuggestedEntity(action, modalType) {
    const target = findTargetEntity(action, modalType);
    if (!target) {
        addChatBubble('system', 'Nao encontrei o item para concluir. Peca usando o titulo exato.');
        return;
    }

    if (modalType !== 'task') {
        addChatBubble('system', 'Conclusao automatica por aprovacao esta disponivel para tarefas. Para outros itens, revise manualmente.');
        return;
    }

    await completeTask(target.id);
    await markSuggestedActionDone(action);
    addChatBubble('system', `Tarefa "${target.title}" concluida com sua aprovacao.`);
}

async function deleteSuggestedEntity(action, modalType) {
    const target = findTargetEntity(action, modalType);
    const config = modalConfigs[modalType];
    if (!target || !config) {
        addChatBubble('system', 'Nao encontrei o item para apagar. Peca usando o titulo exato.');
        return;
    }

    const confirmed = window.confirm(`Apagar "${target.title}"? Essa acao nao pode ser desfeita.`);
    if (!confirmed) return;

    const { error } = await supabaseClient.from(tables[config.table]).delete().eq('id', target.id);
    if (error) {
        addChatBubble('system', error.message);
        return;
    }

    await markSuggestedActionDone(action);
    await loadTable(config.table, defaultOrder(config.table));
    renderAll();
    addChatBubble('system', `"${target.title}" apagado com sua aprovacao.`);
}

async function markSuggestedActionDone(action) {
    if (!action.dbId) return;
    await supabaseClient
        .from(tables.actions)
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', action.dbId);
}

async function addContext(type) {
    if (!state.context.some(item => item.type === type)) {
        state.context.push({ type, label: contextLabel(type), data: getContextData(type) });
    }
    renderContextChips();
}

function addContextFromMessage(message) {
    const types = inferContextTypes(message);
    const addedLabels = [];
    types.forEach(type => {
        if (!state.context.some(item => item.type === type)) {
            const label = contextLabel(type);
            state.context.push({ type, label, data: getContextData(type) });
            addedLabels.push(label);
        }
    });
    renderContextChips();
    return addedLabels;
}

function refreshAttachedContext() {
    state.context = state.context.map(item => ({
        ...item,
        data: item.type === 'briefing' ? item.data : getContextData(item.type)
    }));
}

function buildAiContextPayload(message = '') {
    refreshAttachedContext();
    const snapshot = {
        type: 'operational_snapshot',
        label: 'Snapshot operacional do painel',
        data: getOperationalSnapshotForAi()
    };

    const detailedTypes = new Set(inferContextTypes(message));
    const detailedContext = state.context
        .filter(item => item.type === 'briefing' || detailedTypes.has(item.type))
        .map(item => ({
            type: item.type,
            label: item.label,
            data: item.data
        }));

    return [snapshot, ...detailedContext];
}

function buildRecentChatHistory(maxMessageLength = 600) {
    return state.entities.messages
        .filter(message => ['user', 'assistant'].includes(message.role))
        .slice(-6)
        .map(message => ({
            role: message.role,
            content: plainTruncate(message.content, maxMessageLength),
            created_at: formatDateTimeForAi(message.created_at || new Date().toISOString())
        }));
}

function getClientMeta() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        locale: 'pt-BR',
        now_iso: now.toISOString(),
        now_local: formatDateTimeForAi(now),
        today_key: localDateKey(now),
        tomorrow_key: localDateKey(tomorrow),
        today_label: formatDateOnlyForAi(now),
        tomorrow_label: formatDateOnlyForAi(tomorrow)
    };
}

function inferContextTypes(message) {
    const text = normalizeForSearch(message);
    const types = new Set();

    if (/(hoje|meu dia|dia de hoje|rotina|agora)/.test(text)) types.add('today');
    if (/(amanha|proximo dia|pr[oó]ximo dia|o que eu tenho|o que tenho)/.test(text)) {
        ['tasks', 'calendar', 'editorial'].forEach(type => types.add(type));
    }
    if (/(tarefa|tarefas|pendencia|pendencias|kanban|fazer|fazendo|concluid)/.test(text)) types.add('tasks');
    if (/(calendario|agenda|compromisso|reuniao|evento|eventos|horario)/.test(text)) types.add('calendar');
    if (/(editorial|conteudo|post|posts|instagram|tiktok|email|whatsapp)/.test(text)) types.add('editorial');
    if (/(doc|docs|documento|documentos|icp|concorrente|concorrencia|produto|oferta|empresa|vendas)/.test(text)) types.add('docs');
    if (/(estrategia|estrategias|teste|testes|hipotese|prospeccao|gargalo|vender|venda|cmo)/.test(text)) types.add('strategies');

    if (/(cmo|opus|sonnet|analise profunda|gargalo|porque nao estou vendendo|por que nao estou vendendo|empresa inteira)/.test(text)) {
        ['today', 'tasks', 'calendar', 'editorial', 'docs', 'strategies'].forEach(type => types.add(type));
    }

    return Array.from(types);
}

function contextLabel(type) {
    return {
        today: 'Hoje',
        tasks: 'Tarefas',
        calendar: 'Calendario',
        editorial: 'Editorial',
        docs: 'Docs',
        strategies: 'Estrategias',
        briefing: 'Briefing CMO'
    }[type] || type;
}

async function prepareBriefing() {
    ['today', 'tasks', 'calendar', 'editorial', 'docs', 'strategies'].forEach(type => {
        if (!state.context.some(item => item.type === type)) {
            state.context.push({ type, label: contextLabel(type), data: getContextData(type) });
        }
    });
    renderContextChips();
    addChatBubble('system', 'Preparando briefing CMO com DeepSeek Flash...');

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const response = await fetch('/api/psilu-ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionData.session?.access_token || ''}`
            },
            body: JSON.stringify({
                modelId: 'deepseek-flash',
                message: 'Prepare um briefing CMO curto para Sonnet/Opus. Resuma situacao do dia, tarefas, calendario, editorial, docs, estrategias, gargalos percebidos e proximos pontos de decisao.',
                context: buildAiContextPayload(),
                maxOutputTokens: 1200
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao preparar briefing.');
        state.context = state.context.filter(item => item.type !== 'briefing');
        state.context.push({
            type: 'briefing',
            label: contextLabel('briefing'),
            data: { text: result.text, generated_at: new Date().toISOString() }
        });
        renderContextChips();
        addChatBubble('assistant', result.text, result.usage);
        addChatBubble('system', 'Briefing anexado. Agora escolha Sonnet ou Opus para uma analise CMO em cima desse contexto.');
    } catch (error) {
        addChatBubble('system', `Nao consegui preparar o briefing automaticamente: ${error.message}`);
    }
}

function getContextData(type) {
    if (type === 'today') {
        const today = localDateKey(new Date());
        return {
            tasks: state.entities.tasks.filter(item => localDateKey(item.due_at) === today).map(serializeTaskForAi),
            events: state.entities.events.filter(item => localDateKey(item.starts_at) === today).map(serializeEventForAi),
            editorial: state.entities.editorial.filter(item => localDateKey(item.publish_at) === today).map(serializeEditorialForAi)
        };
    }
    if (type === 'tasks') return state.entities.tasks.map(serializeTaskForAi);
    if (type === 'calendar') return state.entities.events.map(serializeEventForAi);
    if (type === 'editorial') return state.entities.editorial.map(serializeEditorialForAi);
    if (type === 'docs') return state.entities.docs.map(serializeDocForAi);
    if (type === 'strategies') return state.entities.strategies.map(serializeStrategyForAi);
    return state.entities[type] || [];
}

function getOperationalSnapshotForAi() {
    const tasks = state.entities.tasks.map(serializeCompactTaskForAi);
    const events = state.entities.events.map(serializeCompactEventForAi);
    const editorial = state.entities.editorial.map(serializeCompactEditorialForAi);
    const docs = state.entities.docs.map(serializeCompactDocForAi);
    const strategies = state.entities.strategies.map(serializeCompactStrategyForAi);
    const todayKey = localDateKey(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = localDateKey(tomorrowDate);

    return {
        generated_at_local: formatDateTimeForAi(new Date()),
        counts: {
            tasks: tasks.length,
            open_tasks: tasks.filter(task => task.status !== 'concluido').length,
            events: events.length,
            editorial_items: editorial.length,
            docs: docs.length,
            strategies: strategies.length
        },
        today: {
            date_key: todayKey,
            tasks: tasks.filter(task => task.due_date_key === todayKey),
            events: events.filter(event => event.starts_date_key === todayKey),
            editorial: editorial.filter(item => item.publish_date_key === todayKey)
        },
        tomorrow: {
            date_key: tomorrowKey,
            tasks: tasks.filter(task => task.due_date_key === tomorrowKey),
            events: events.filter(event => event.starts_date_key === tomorrowKey),
            editorial: editorial.filter(item => item.publish_date_key === tomorrowKey)
        },
        all_tasks: tasks,
        all_events: events,
        all_editorial: editorial,
        docs,
        strategies
    };
}

function renderContextChips() {
    els.contextChipRow.innerHTML = state.context.map(item => `<span class="context-chip">${escapeHTML(item.label)}</span>`).join('');
}

function renderModelOptions() {
    els.modelSelect.innerHTML = MODELS.map(model => `<option value="${model.id}">${model.label}</option>`).join('');
    els.modelMenu.innerHTML = MODELS.map(model => `
        <button type="button" class="model-option" data-model-id="${escapeHTML(model.id)}">
            <span>${escapeHTML(model.label)}</span>
            <small>${model.family === 'claude' ? 'CMO' : 'Operação'}</small>
        </button>
    `).join('');
    els.modelMenu.querySelectorAll('[data-model-id]').forEach(button => {
        button.addEventListener('click', () => selectModel(button.dataset.modelId));
    });
    updateModelCurrentLabel();
}

function selectModel(modelId) {
    els.modelSelect.value = modelId;
    updateModelCurrentLabel();
    closeModelMenu();
}

function updateModelCurrentLabel() {
    const selectedModel = MODELS.find(model => model.id === els.modelSelect.value) || MODELS[0];
    els.modelCurrentLabel.textContent = selectedModel ? selectedModel.label : 'DeepSeek Flash';
    els.modelMenu?.querySelectorAll('[data-model-id]').forEach(button => {
        button.classList.toggle('active', button.dataset.modelId === selectedModel?.id);
    });
}

function toggleModelMenu() {
    const isOpening = els.modelMenu.classList.contains('hidden');
    els.modelMenu.classList.toggle('hidden', !isOpening);
    els.modelMenuBtn.setAttribute('aria-expanded', String(isOpening));
}

function closeModelMenu() {
    els.modelMenu.classList.add('hidden');
    els.modelMenuBtn.setAttribute('aria-expanded', 'false');
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

function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function plainTruncate(value, maxLength) {
    const text = String(value || '').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function serializeTaskForAi(task) {
    return {
        id: task.id,
        title: task.title,
        description: task.description || '',
        status: task.status || 'a_fazer',
        priority: task.priority || 'media',
        origin: task.origin || 'manual',
        due_at_iso: task.due_at || null,
        due_at_local: formatDateTimeForAi(task.due_at),
        due_date_key: localDateKey(task.due_at),
        completed_at_local: formatDateTimeForAi(task.completed_at),
        updated_at_local: formatDateTimeForAi(task.updated_at)
    };
}

function serializeCompactTaskForAi(task) {
    return {
        id: task.id,
        title: task.title,
        description_preview: plainTruncate(task.description || '', 140),
        status: task.status || 'a_fazer',
        priority: task.priority || 'media',
        due_at_local: formatDateTimeForAi(task.due_at),
        due_date_key: localDateKey(task.due_at)
    };
}

function serializeEventForAi(event) {
    return {
        id: event.id,
        title: event.title,
        description: event.description || '',
        event_type: event.event_type || 'operacao',
        starts_at_iso: event.starts_at || null,
        starts_at_local: formatDateTimeForAi(event.starts_at),
        starts_date_key: localDateKey(event.starts_at),
        ends_at_local: formatDateTimeForAi(event.ends_at)
    };
}

function serializeCompactEventForAi(event) {
    return {
        id: event.id,
        title: event.title,
        description_preview: plainTruncate(event.description || '', 140),
        event_type: event.event_type || 'operacao',
        starts_at_local: formatDateTimeForAi(event.starts_at),
        starts_date_key: localDateKey(event.starts_at),
        ends_at_local: formatDateTimeForAi(event.ends_at)
    };
}

function serializeEditorialForAi(item) {
    return {
        id: item.id,
        title: item.title,
        channel: item.channel || '',
        status: item.status || 'ideia',
        publish_at_iso: item.publish_at || null,
        publish_at_local: formatDateTimeForAi(item.publish_at),
        publish_date_key: localDateKey(item.publish_at),
        summary: item.summary || '',
        notes: item.notes || ''
    };
}

function serializeCompactEditorialForAi(item) {
    return {
        id: item.id,
        title: item.title,
        channel: item.channel || '',
        status: item.status || 'ideia',
        publish_at_local: formatDateTimeForAi(item.publish_at),
        publish_date_key: localDateKey(item.publish_at),
        summary_preview: plainTruncate(item.summary || '', 160)
    };
}

function serializeDocForAi(doc) {
    return {
        id: doc.id,
        title: doc.title,
        category: doc.category || 'Outro',
        tags: doc.tags || '',
        content: plainTruncate(doc.content || '', 900),
        updated_at_local: formatDateTimeForAi(doc.updated_at)
    };
}

function serializeCompactDocForAi(doc) {
    return {
        id: doc.id,
        title: doc.title,
        category: doc.category || 'Outro',
        tags: doc.tags || '',
        content_preview: plainTruncate(doc.content || '', 220),
        updated_at_local: formatDateTimeForAi(doc.updated_at)
    };
}

function serializeStrategyForAi(strategy) {
    return {
        id: strategy.id,
        title: strategy.title,
        category: strategy.category || 'Marketing',
        description: plainTruncate(strategy.description || '', 600),
        notes: plainTruncate(strategy.notes || '', 600),
        updated_at_local: formatDateTimeForAi(strategy.updated_at)
    };
}

function serializeCompactStrategyForAi(strategy) {
    return {
        id: strategy.id,
        title: strategy.title,
        category: strategy.category || 'Marketing',
        description_preview: plainTruncate(strategy.description || '', 220),
        notes_preview: plainTruncate(strategy.notes || '', 140),
        updated_at_local: formatDateTimeForAi(strategy.updated_at)
    };
}

function formatDateTimeForAi(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateOnlyForAi(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function normalizeForSearch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function inferDateTimeFromText(value) {
    const text = normalizeForSearch(value);
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
    let hasDateClue = false;

    if (/\bamanha\b/.test(text)) {
        date.setDate(date.getDate() + 1);
        hasDateClue = true;
    } else {
        const explicitDate = text.match(/\b(?:dia\s*)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
        if (explicitDate) {
            const day = Number(explicitDate[1]);
            const month = Number(explicitDate[2]) - 1;
            const year = explicitDate[3]
                ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
                : now.getFullYear();
            date.setFullYear(year, month, day);
            hasDateClue = true;
        } else if (/\bhoje\b/.test(text)) {
            hasDateClue = true;
        }
    }

    const hourMatch = text.match(/\b(?:as|a)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?| horas?)?\b/) || text.match(/\b(\d{1,2})(?::(\d{2})|h(\d{2})?)\b/);
    if (hourMatch) {
        date.setHours(Number(hourMatch[1]), Number(hourMatch[2] || hourMatch[3] || 0), 0, 0);
        hasDateClue = true;
    }

    if (!hasDateClue) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
