import { S3Client, GetObjectCommand, HeadObjectCommand } from "npm:@aws-sdk/client-s3@3.992.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.992.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sanitizeRequestedKey(key: string): string {
  return key.replace(/^\/+/, "").replace(/\.\./g, "");
}

function withCors(headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  Object.entries(corsHeaders).forEach(([k, v]) => merged.set(k, v));
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }

  try {
    const url = new URL(req.url);
    const rawKey = url.searchParams.get("key") ?? "";
    const key = sanitizeRequestedKey(rawKey);

    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const accountId = getRequiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket = getRequiredEnv("R2_BUCKET_NAME");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    if (req.method === "HEAD") {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return new Response(null, {
        status: 200,
        headers: withCors({
          "Content-Type": head.ContentType || "application/octet-stream",
          "Content-Length": String(head.ContentLength ?? 0),
          "Cache-Control": "public, max-age=31536000, immutable",
        }),
      });
    }

    const signed = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 * 10 },
    );

    return new Response(null, {
      status: 302,
      headers: withCors({
        Location: signed,
        "Cache-Control": "private, no-store",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("NotFound") || message.includes("NoSuchKey") ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});
