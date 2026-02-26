import { supabase } from './supabase';

export async function submitFinancialMutation(action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.access_token) {
        throw new Error('Not authenticated.');
    }

    const response = await fetch('/.netlify/functions/financial-write', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...payload })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while saving financial records.');
    }

    return data;
}
