import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.992.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sanitizePathPart(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .join("/");
}

async function ensurePublicUrlReachable(url: string): Promise<void> {
  let lastStatus = 0;
  let lastError = "";

  for (let i = 0; i < 3; i += 1) {
    try {
      const probeUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}-${i}`;
      const res = await fetch(probeUrl, { method: "HEAD" });
      lastStatus = res.status;
      if (res.ok) return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown probe error";
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const details = lastError
    ? `public URL probe failed: ${lastError}`
    : `public URL returned HTTP ${lastStatus}`;
  throw new Error(`Upload completed but file is not publicly reachable (${details}). Check R2_PUBLIC_URL and bucket public access.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid or expired token" });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folderRaw = String(formData.get("folder") ?? "general");
    const folder = sanitizePathPart(folderRaw) || "general";

    if (!(file instanceof File)) {
      return jsonResponse(400, { error: "No file uploaded" });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse(400, { error: "Invalid file type" });
    }

    if (file.size > MAX_SIZE) {
      return jsonResponse(400, { error: "File size too large (max 5MB)" });
    }

    const accountId = getRequiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket = getRequiredEnv("R2_BUCKET_NAME");
    const publicUrl = getRequiredEnv("R2_PUBLIC_URL");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const timestamp = Date.now();
    const safeName = sanitizeFilename(file.name || "upload.bin");
    const key = `${folder}/${user.id}/${timestamp}-${safeName}`;
    const body = new Uint8Array(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const url = `${publicUrl}/${key}`;
    await ensurePublicUrlReachable(url);

    return jsonResponse(200, { url, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse(500, { error: message });
  }
});
