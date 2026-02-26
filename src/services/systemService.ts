import { supabase } from "../lib/supabase";

export interface SystemSettings {
    id?: string;
    church_name: string;
    church_address: string;
    system_name: string;
    system_version: string;
    church_logo_url?: string;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    action_type: string;
    description: string;
    user_id?: string;
}

/**
 * Fetches the current system settings.
 */
export const getSettings = async (): Promise<SystemSettings | null> => {
    const { data, error } = await supabase.from('system_settings').select('*').maybeSingle();
    if (error) {
        throw new Error(`Failed to fetch system settings: ${error.message}`);
    }
    return data as SystemSettings;
};

/**
 * Upserts system settings.
 */
export const upsertSettings = async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const { count } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });

    let result;
    if (count === 0) {
        const { data, error } = await supabase.from('system_settings').insert(settings).select().single();
        if (error) throw new Error(`Failed to insert settings: ${error.message}`);
        result = data;
    } else {
        const settingsRecord = await getSettings();
        const { data, error } = await supabase.from('system_settings').update(settings).eq('id', settingsRecord?.id).select().single();
        if (error) throw new Error(`Failed to update settings: ${error.message}`);
        result = data;
    }

    return result as SystemSettings;
};

/**
 * Fetches recent audit logs.
 */
export const getAuditLogs = async (limit = 20): Promise<AuditLog[]> => {
    const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
    return data as AuditLog[];
};

/**
 * Fetches backup data for specified tables.
 */
export const getBackupData = async (tables: string[]): Promise<Record<string, any[]>> => {
    const backup: Record<string, any[]> = {};
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            throw new Error(`Failed to fetch backup data for table ${table}: ${error.message}`);
        }
        if (data) backup[table] = data;
    }
    return backup;
};

