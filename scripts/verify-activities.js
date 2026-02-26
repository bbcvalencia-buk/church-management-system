import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTable() {
    console.log("Checking activities table schema...");

    // Check if column exists by trying to select it
    const { data, error } = await supabase
        .from('activities')
        .select('activity_data')
        .limit(1);

    if (error) {
        console.error("Error querying activity_data column:", error.message);
        if (error.message.includes('column "activity_data" does not exist')) {
            console.log("CRITICAL: activity_data column is MISSING.");
        }
    } else {
        console.log("SUCCESS: activity_data column exists in activities table.");
        console.log("Sample data:", data);
    }

    const { data: allActivities, error: fetchError } = await supabase
        .from('activities')
        .select('*')
        .limit(5);

    if (fetchError) {
        console.error("Error fetching activities:", fetchError.message);
    } else {
        console.log(`Fetched ${allActivities.length} activities.`);
        allActivities.forEach(a => {
            console.log(`- ID: ${a.id}, Type: ${a.activity_type}, Created At: ${a.created_at || 'N/A'}`);
            console.log(`  Data: ${JSON.stringify(a.activity_data)}`);
        });
    }
}

verifyTable();
