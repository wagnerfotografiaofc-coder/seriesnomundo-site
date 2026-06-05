const SUPABASE_URL = 'https://oxrtghthalavxcyqskaz.supabase.co';

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    if (process.env.EVENTOCRIATIVO_CLEANUP_SECRET) {
        const providedSecret = String(request.headers['x-eventocriativo-cleanup-secret'] || '');
        if (providedSecret !== process.env.EVENTOCRIATIVO_CLEANUP_SECRET) {
            return response.status(401).json({ error: 'Segredo de limpeza invalido.' });
        }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return response.status(200).json({ ok: false, message: 'Configure SUPABASE_SERVICE_ROLE_KEY para ativar a limpeza.' });
    }

    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const cleanupResponse = await fetch(`${SUPABASE_URL}/rest/v1/eventocriativo_ai_chats?created_at=lt.${encodeURIComponent(cutoff)}`, {
        method: 'DELETE',
        headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    });

    if (!cleanupResponse.ok) {
        return response.status(500).json({ ok: false, message: 'Nao foi possivel limpar chats antigos.' });
    }

    return response.status(200).json({ ok: true, cutoff });
};

