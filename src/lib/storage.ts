
import { supabase } from "./supabase";

const parseResponseBody = async (response: Response): Promise<any> => {
    const raw = await response.text();
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return { raw };
    }
};

const invokeSupabaseFunction = async (
    functionName: string,
    options: {
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        body?: BodyInit | null;
        contentType?: string;
    } = {}
) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error("Missing VITE_SUPABASE_URL");
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`
    };

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseAnonKey) {
        headers.apikey = supabaseAnonKey;
    }

    if (options.contentType) {
        headers["Content-Type"] = options.contentType;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: options.method || "POST",
        headers,
        body: options.body ?? null
    });

    const payload = await parseResponseBody(response);
    if (!response.ok) {
        const contentType = response.headers.get("content-type") || "unknown";
        const message = payload?.error
            || payload?.message
            || (typeof payload?.raw === "string" ? payload.raw.slice(0, 180) : "");

        if (response.status === 404) {
            throw new Error(
                `Supabase function "${functionName}" not found (HTTP 404). Deploy it with: supabase functions deploy ${functionName}.`
            );
        }

        throw new Error(
            message
                ? `${functionName} failed (HTTP ${response.status}, ${contentType}): ${message}`
                : `${functionName} failed (HTTP ${response.status}, ${contentType})`
        );
    }

    return payload;
};

/**
 * Uploads a file to R2 via Supabase Edge Function.
 */
export const uploadFile = async (file: File, folder: string): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const data = await invokeSupabaseFunction("r2-upload", { body: formData });
        if (!data?.url) throw new Error("Upload succeeded but no URL was returned.");
        return data.url;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
};

/**
 * Deletes a single file from R2 via Supabase Edge Function.
 */
export const deleteFile = async (fileUrl: string): Promise<void> => {
    try {
        const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;
        if (!fileUrl.startsWith(R2_PUBLIC_URL)) return;

        const key = fileUrl.replace(`${R2_PUBLIC_URL}/`, '');

        await invokeSupabaseFunction("r2-delete", {
            body: JSON.stringify({ key: decodeURIComponent(key) }),
            contentType: "application/json"
        });
    } catch (error) {
        console.error("Error deleting file:", error);
    }
};

/**
 * Deletes multiple files from R2.
 */
export const deleteFiles = async (fileUrls: string[]): Promise<void> => {
    for (const url of fileUrls) {
        await deleteFile(url);
    }
};

export const getPublicUrl = (key: string): string => {
    const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;
    return `${R2_PUBLIC_URL}/${key}`;
};
