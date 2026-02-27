import { supabase } from './supabase';

export async function submitFinancialMutation(action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.access_token) {
        throw new Error('Not authenticated.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl) {
        throw new Error('Missing VITE_SUPABASE_URL');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/financial-write`, {
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
        if (response.status === 404) {
            throw new Error('Supabase function "financial-write" not found (HTTP 404). Deploy it with: supabase functions deploy financial-write.');
        }
        throw new Error(data.error || 'An error occurred while saving financial records.');
    }

    return data;
}
