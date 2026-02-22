
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.warn('Missing Cloudflare R2 credentials - file uploads will fail');
}

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true, // Recommended for R2 and some S3-compatible scenarios
    // Fix for "readableStream.getReader is not a function" error
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
});

export const uploadFile = async (file: File, path: string): Promise<string> => {
    try {
        const key = `${path}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: file,
            ContentType: file.type,
        }));

        // Construct public URL
        return `${R2_PUBLIC_URL}/${key}`;
    } catch (error) {
        console.error("Error uploading file to R2:", error);
        throw error;
    }
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
    await deleteFiles([fileUrl]);
};

export const deleteFiles = async (fileUrls: string[]): Promise<void> => {
    try {
        if (!fileUrls || fileUrls.length === 0 || !R2_PUBLIC_URL) return;

        const objectsToDelete = fileUrls
            .filter(url => url && url.startsWith(R2_PUBLIC_URL))
            .map(url => {
                const key = url.replace(`${R2_PUBLIC_URL}/`, '');
                return { Key: decodeURIComponent(key) };
            });

        if (objectsToDelete.length === 0) return;

        // Delete all in parallel using individual DeleteObjectCommand (since we didn't import DeleteObjects)
        await Promise.all(objectsToDelete.map(obj =>
            s3Client.send(new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: obj.Key
            }))
        ));
    } catch (error) {
        console.error("Error deleting files from R2:", error);
        // Don't throw, just log. We don't want to block DB delete if file delete fails.
    }
};

export const getPublicUrl = (key: string): string => {
    return `${R2_PUBLIC_URL}/${key}`;
}
