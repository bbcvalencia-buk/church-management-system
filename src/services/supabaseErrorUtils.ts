type MaybeSupabaseError = {
    code?: string;
    message?: string;
};

const missingTableCache = new Set<string>();

/**
 * Returns true when Supabase/PostgREST indicates a queried table is missing.
 */
export const isMissingTableError = (error: unknown): boolean => {
    const e = error as MaybeSupabaseError | null | undefined;
    if (!e) return false;

    const message = (e.message || "").toLowerCase();
    return (
        e.code === "42P01" ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the table")
    );
};

export const markTableMissing = (tableName: string): void => {
    if (tableName) missingTableCache.add(tableName);
};

export const isTableMarkedMissing = (tableName: string): boolean => {
    return missingTableCache.has(tableName);
};
