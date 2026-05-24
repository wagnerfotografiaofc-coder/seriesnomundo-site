const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const loginPanel = document.getElementById('login-panel');
    const aiContent = document.getElementById('ai-content');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginMessage = document.getElementById('login-message');
    const authStatus = document.getElementById('auth-status');
    const postCount = document.getElementById('post-count');
    const briefingsInput = document.getElementById('briefings-input');
    const generatedOutput = document.getElementById('generated-output');
    const generateBtn = document.getElementById('generate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const statusMessage = document.getElementById('status-message');

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

    async function handleGenerate() {
        const briefings = briefingsInput.value.trim();
        const count = Math.min(10, Math.max(1, parseInt(postCount.value, 10) || 1));

        if (!briefings) {
            setStatus('Cole pelo menos uma ideia ou resumo antes de gerar.', 'error');
            return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
            setStatus('Sessao expirada. Entre novamente.', 'error');
            showLogin();
            return;
        }

        generateBtn.disabled = true;
        generatedOutput.value = '';
        setStatus(`Gerando ${count} post${count > 1 ? 's' : ''}... isso pode levar um pouco.`, '');

        try {
            const response = await fetch('/api/generate-posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ count, briefings })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.error || 'Nao foi possivel gerar os posts.');
            }

            generatedOutput.value = result.content || '';
            setStatus(`${count} post${count > 1 ? 's' : ''} gerado${count > 1 ? 's' : ''}. Revise antes de importar.`, 'success');
        } catch (error) {
            setStatus(error.message, 'error');
        } finally {
            generateBtn.disabled = false;
        }
    }

    async function handleCopy() {
        if (!generatedOutput.value.trim()) {
            setStatus('Ainda nao tem resultado para copiar.', 'error');
            return;
        }

        await navigator.clipboard.writeText(generatedOutput.value);
        setStatus('Resultado copiado.', 'success');
    }

    loginForm.addEventListener('submit', handleLogin);
    generateBtn.addEventListener('click', handleGenerate);
    clearBtn.addEventListener('click', () => {
        briefingsInput.value = '';
        generatedOutput.value = '';
        setStatus('');
    });
    copyBtn.addEventListener('click', handleCopy);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session) showTool(session);
        else showLogin();
    });

    supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) showTool(data.session);
        else showLogin();
    });
});
