import { supabase } from './supabase';

export async function submitFinancialMutation(action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.access_token) {
        throw new Error('Not authenticated.');
    }

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const endpoint = import.meta.env.VITE_URL ? `${import.meta.env.VITE_URL}/.netlify/functions/financial-write` : '/.netlify/functions/financial-write';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {})
        },
        body: JSON.stringify({ action, ...payload })
    });

    const rawBody = await response.text();
    let data: any = {};
    if (rawBody) {
        try {
            data = JSON.parse(rawBody);
        } catch {
            data = { error: rawBody };
        }
    }

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while saving financial records. (Note: Make sure to start the app with Netlify Dev when testing locally)');
    }

    return data;
}
