
import { supabase } from "./supabase";

/**
 * Uploads a file to R2 via Netlify serverless function.
 * Moves sensitive credentials to the server-side.
 */
export const uploadFile = async (file: File, folder: string): Promise<string> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await fetch('/.netlify/functions/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
};

/**
 * Deletes a single file from R2 via Netlify serverless function.
 */
export const deleteFile = async (fileUrl: string): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // Silent fail for delete if unauthorized

        const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;
        if (!fileUrl.startsWith(R2_PUBLIC_URL)) return;

        const key = fileUrl.replace(`${R2_PUBLIC_URL}/`, '');

        const response = await fetch('/.netlify/functions/delete-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ key: decodeURIComponent(key) })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Delete failed:", errorData.error);
        }
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
}
