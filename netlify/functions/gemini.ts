import type { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ALLOWED_FEATURES = ['sermon-summary', 'attendance-insight', 'visitor-card-ocr'];

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization header' }) };
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token.' }) };
        }

        const { prompt, feature } = JSON.parse(event.body || '{}');

        if (!prompt || !feature) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt and feature are required' }) };
        }

        if (!ALLOWED_FEATURES.includes(feature)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid feature' }) };
        }

        // Rate limiting: 10 requests per user per hour
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const { count, error: countError } = await supabase
            .from('ai_request_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', oneHourAgo.toISOString());

        if (countError) throw countError;

        if (count !== null && count >= 10) {
            return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) };
        }

        // Call Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Log the request
        await supabase.from('ai_request_logs').insert({
            user_id: user.id,
            feature: feature
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ response: text })
        };
    } catch (e: any) {
        console.error('Gemini Function Error:', e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal server error.' }) };
    }
};
