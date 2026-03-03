import { supabase } from './supabase';

export async function submitFinancialMutation(action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.access_token) {
        throw new Error('Not authenticated.');
    }

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error('Missing Supabase URL configuration.');
    }
    const endpoint = `${supabaseUrl}/functions/v1/financial-write`;

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
        throw new Error(data.error || 'An error occurred while saving financial records.');
    }

    return data;
}
