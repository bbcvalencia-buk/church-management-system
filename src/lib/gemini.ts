import { supabase } from "./supabase";

export type GeminiFeature = 'sermon-summary' | 'attendance-insight' | 'visitor-card-ocr';

/**
 * Calls the central Gemini AI serverless function.
 * Rate limited to 10 requests per user per hour.
 */
export const callGemini = async (prompt: string, feature: GeminiFeature): Promise<string> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Unauthorized");

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ prompt, feature })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI Request failed');
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
};
