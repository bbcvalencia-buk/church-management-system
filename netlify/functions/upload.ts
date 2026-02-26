import type { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL; // Public URL can stay public

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

        // Parse multipart form
        const result = await new Promise<{ file: Buffer, filename: string, contentType: string, folder: string }>((resolve, reject) => {
            const busboy = Busboy({ headers: event.headers });
            let fileBuffer: Buffer | null = null;
            let fileName = '';
            let fileType = '';
            let folderName = 'general';

            busboy.on('file', (fieldname, file, info) => {
                const { filename, mimeType } = info;
                fileName = filename;
                fileType = mimeType;
                const chunks: any[] = [];
                file.on('data', (data) => chunks.push(data));
                file.on('end', () => {
                    fileBuffer = Buffer.concat(chunks);
                });
            });

            busboy.on('field', (fieldname, value) => {
                if (fieldname === 'folder') folderName = value;
            });

            busboy.on('finish', () => {
                if (fileBuffer && fileName) {
                    resolve({ file: fileBuffer, filename: fileName, contentType: fileType, folder: folderName });
                } else {
                    reject(new Error('No file uploaded'));
                }
            });

            busboy.on('error', (err) => reject(err));

            const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '');
            busboy.end(body);
        });

        // Validation
        if (result.file.length > MAX_SIZE) {
            return { statusCode: 400, body: JSON.stringify({ error: 'File size too large (max 5MB)' }) };
        }

        if (!ALLOWED_TYPES.includes(result.contentType)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid file type' }) };
        }

        const timestamp = Date.now();
        const safeName = result.filename.replace(/\s+/g, '-');
        const key = `${result.folder}/${user.id}/${timestamp}-${safeName}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: result.file,
            ContentType: result.contentType,
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({
                url: `${R2_PUBLIC_URL}/${key}`,
                key: key
            })
        };
    } catch (e: any) {
        console.error('Upload Function Error:', e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal server error.' }) };
    }
};
