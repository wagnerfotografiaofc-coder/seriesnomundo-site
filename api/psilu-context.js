const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cnRnaHRoYWxhdnhjeXFza2F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODgzMjgsImV4cCI6MjA3NTU2NDMyOH0.u_3mOi8xzBv59Xs08ZDYz4nu_QOZHFHuIMzwPfTsvtk';

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return response.status(401).json({ error: 'Sessao obrigatoria.' });

    try {
        const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
        });
        if (!authResponse.ok) return response.status(401).json({ error: 'Sessao invalida.' });

        const body = parseBody(request.body);
        const wanted = Array.isArray(body.sections) ? body.sections : ['tasks', 'calendar', 'editorial', 'docs', 'strategies'];
        const result = {};

        for (const section of wanted) {
            const table = tableFor(section);
            if (!table) continue;
            result[section] = await fetchTable(table, token);
        }

        return response.status(200).json({ context: result });
    } catch (error) {
        return response.status(500).json({ error: error.message || 'Erro interno.' });
    }
};

async function fetchTable(table, token) {
    const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY
        }
    });
    if (!tableResponse.ok) return [];
    return tableResponse.json();
}

function tableFor(section) {
    return {
        tasks: 'psilu_tasks',
        calendar: 'psilu_calendar_events',
        editorial: 'psilu_editorial_items',
        docs: 'psilu_docs',
        strategies: 'psilu_strategies'
    }[section];
}

function parseBody(body) {
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch (_error) {
            return {};
        }
    }
    return body;
}
