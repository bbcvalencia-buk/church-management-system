import { supabase } from "../lib/supabase";
import type { FinancialRecord, FaithPromiseLedger } from "../types";

/**
 * Fetches financial records within a date range and by deletion status.
 */
export const getFinancialRecords = async (start: string, end: string, activeTab: 'active' | 'deleted' | 'faith_promise'): Promise<any[]> => {
    let query = supabase
        .from('financial_records')
        .select('id, member_id, transaction_date, transaction_type, amount, pledge_purpose, deleted_at, members(first_name, surname)')
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false });

    if (activeTab === 'deleted') {
        query = query.not('deleted_at', 'is', null);
    } else {
        query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch financial records: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches the latest financial transaction date for an active tab filter.
 */
export const getLatestFinancialTransactionDate = async (
    activeTab: 'active' | 'deleted' | 'faith_promise'
): Promise<string | null> => {
    let query = supabase
        .from('financial_records')
        .select('transaction_date')
        .order('transaction_date', { ascending: false })
        .limit(1);

    if (activeTab === 'deleted') {
        query = query.not('deleted_at', 'is', null);
    } else {
        query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch latest financial transaction date: ${error.message}`);
    }

    return data?.[0]?.transaction_date || null;
};

/**
 * Fetches all financial records for a given year.
 */
export const getFinancialRecordsByYear = async (year: number, memberId?: string): Promise<any[]> => {
    let query = supabase
        .from("financial_records")
        .select("*, members(*)")
        .is("deleted_at", null)
        .gte("transaction_date", `${year}-01-01`)
        .lte("transaction_date", `${year}-12-31`)
        .order("transaction_date");

    if (memberId && memberId !== 'all') {
        query = query.eq("member_id", memberId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch financial records: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches all period locks for financial records.
 */
export const getFinancialPeriodLocks = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('financial_period_locks').select('*');
    if (error) {
        throw new Error(`Failed to fetch period locks: ${error.message}`);
    }
    return data || [];
};

/**
 * Locks a specific financial period.
 */
export const lockFinancialPeriod = async (year: number, month: number, userId: string): Promise<void> => {
    const { error } = await supabase
        .from('financial_period_locks')
        .insert([{
            year,
            month,
            locked_by: userId
        }]);

    if (error) {
        throw new Error(`Failed to lock period: ${error.message}`);
    }
};

/**
 * Unlocks a specific financial period.
 */
export const unlockFinancialPeriod = async (year: number, month: number, userId: string): Promise<void> => {
    const { error } = await supabase
        .from('financial_period_locks')
        .update({ unlocked_at: new Date().toISOString(), unlocked_by: userId })
        .eq('year', year)
        .eq('month', month)
        .is('unlocked_at', null);

    if (error) {
        throw new Error(`Failed to unlock period: ${error.message}`);
    }
};

/**
 * Restores a deleted financial record.
 */
export const restoreFinancialTransaction = async (memberId: string, date: string): Promise<void> => {
    const { error } = await supabase.from('financial_records')
        .update({ deleted_at: null, deleted_by: null })
        .eq('member_id', memberId)
        .eq('transaction_date', date);

    if (error) {
        throw new Error(`Failed to restore transaction: ${error.message}`);
    }
};

/**
 * Fetches faith promise commitments for multiple members and year.
 */
export const getFaithPromiseCommitmentsByYear = async (year: number, memberIds: string[]): Promise<any[]> => {
    if (memberIds.length === 0) return [];
    const { data, error } = await supabase
        .from("faith_promise_commitments")
        .select("member_id, promised_amount")
        .eq("year", year)
        .in("member_id", memberIds);

    if (error) {
        throw new Error(`Failed to fetch commitments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches faith promise commitments for a single member.
 */
export const getFaithPromiseCommitments = async (memberId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('faith_promise_commitments')
        .select('*')
        .eq('member_id', memberId)
        .order('year', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch faith promise commitments: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches financial records for a member of type faith_promise.
 */
export const getFaithPromiseGiving = async (memberId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('financial_records')
        .select('amount, transaction_date')
        .eq('member_id', memberId)
        .eq('transaction_type', 'faith_promise')
        .is('deleted_at', null);

    if (error) {
        throw new Error(`Failed to fetch faith promise giving: ${error.message}`);
    }
    return data || [];
};

/**
 * Fetches faith promise ledger records.
 */
export const getFaithPromiseLedger = async (year: number, memberId?: string): Promise<FaithPromiseLedger[]> => {
    let query = supabase
        .from('faith_promise_ledger')
        .select('*')
        .eq('year', year)
        .order('surname');

    if (memberId && memberId !== 'all') {
        query = query.eq('member_id', memberId);
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(`Failed to fetch ledger: ${error.message}`);
    }
    return data as FaithPromiseLedger[];
};

/**
 * Fetches faith promise transactions for specific year and members.
 */
export const getFaithPromiseTransactions = async (year: number, memberIds: string[]): Promise<any[]> => {
    if (memberIds.length === 0) return [];
    const { data, error } = await supabase
        .from('financial_records')
        .select('member_id, transaction_date, amount')
        .eq('transaction_type', 'faith_promise')
        .in('member_id', memberIds)
        .is('deleted_at', null)
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`);

    if (error) {
        throw new Error(`Failed to fetch faith promise transactions: ${error.message}`);
    }
    return data || [];
};

/**
 * Upserts a faith promise commitment.
 */
export const upsertFaithPromiseCommitment = async (payload: any): Promise<void> => {
    const { error } = await supabase
        .from("faith_promise_commitments")
        .upsert(payload, { onConflict: payload.id ? 'id' : 'member_id, year' });

    if (error) {
        throw new Error(`Failed to save faith promise commitment: ${error.message}`);
    }
};

/**
 * Deletes faith promise commitments.
 */
export const deleteFaithPromiseCommitments = async (ids: string[]): Promise<void> => {
    const { error } = await supabase
        .from("faith_promise_commitments")
        .delete()
        .in("id", ids);

    if (error) {
        throw new Error(`Failed to delete faith promise commitments: ${error.message}`);
    }
};

/**
 * Executes a financial mutation (INSERT, UPDATE, DELETE) via Netlify function.
 */
export const submitFinancialMutation = async (action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any): Promise<any> => {
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
};

