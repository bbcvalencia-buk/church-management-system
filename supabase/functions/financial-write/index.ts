import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MutationAction = "INSERT" | "UPDATE" | "DELETE";

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

function asArray(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [value as Record<string, unknown>];
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
    const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid or expired token." });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "") as MutationAction;

    if (!["INSERT", "UPDATE", "DELETE"].includes(action)) {
      return jsonResponse(400, { error: "Invalid action." });
    }

    const { data: memberData, error: memberError } = await adminClient
      .from("members")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (memberError || !memberData) {
      return jsonResponse(403, { error: "You do not have permission to modify financial records." });
    }

    const { data: roleRows, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("member_id", memberData.id)
      .in("role", ["church_administrator", "treasurer"]);

    if (roleError || !roleRows || roleRows.length === 0) {
      return jsonResponse(403, { error: "You do not have permission to modify financial records." });
    }

    let result: unknown = null;
    const records = asArray(body?.records);

    if (action === "DELETE") {
      const targetIds = records.map((r) => r.id).filter(Boolean) as string[];
      const targetMemberId = body?.member_id as string | undefined;
      const targetDate = body?.transaction_date as string | undefined;
      const updatePayload = { deleted_at: new Date().toISOString(), deleted_by: user.id };

      if (targetMemberId && targetDate) {
        const { data, error } = await adminClient
          .from("financial_records")
          .update(updatePayload)
          .eq("member_id", targetMemberId)
          .eq("transaction_date", targetDate)
          .select();
        if (error) throw error;
        result = data;
      } else if (targetIds.length > 0) {
        const { data, error } = await adminClient
          .from("financial_records")
          .update(updatePayload)
          .in("id", targetIds)
          .select();
        if (error) throw error;
        result = data;
      } else {
        return jsonResponse(400, { error: "Missing items to delete" });
      }
    } else if (action === "INSERT") {
      const { data, error } = await adminClient
        .from("financial_records")
        .insert(records)
        .select();
      if (error) throw error;
      result = data;
    } else if (action === "UPDATE") {
      const { data, error } = await adminClient
        .from("financial_records")
        .upsert(records)
        .select();
      if (error) throw error;
      result = data;
    }

    return jsonResponse(200, { message: "Success", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    if (message.includes("Period") && message.includes("is locked")) {
      return jsonResponse(403, { error: "The selected financial period is locked. Please contact the administrator." });
    }
    return jsonResponse(500, { error: message });
  }
});
