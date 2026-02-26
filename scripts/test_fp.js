import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("Testing Database Functions...");
  const { data: q1, error: e1 } = await supabase.rpc("count_sundays_in_year", { p_year: 2025 });
  console.log("count_sundays_in_year(2025):", q1, e1?.message || "OK");

  const { data: q2, error: e2 } = await supabase.rpc("sundays_elapsed_in_year", { p_year: 2025 });
  console.log("sundays_elapsed_in_year(2025):", q2, e2?.message || "OK");

  console.log("\nTesting view exists...");
  const { data: q3, error: e3 } = await supabase.from("faith_promise_ledger").select("*").limit(1);
  console.log("faith_promise_ledger exists:", q3 ? "Yes" : "No", e3?.message || "OK");
}

runTests();
