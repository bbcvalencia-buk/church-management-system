import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log("Inserting test Bible Study activity...");
    const testData = {
        activity_type: 'bible_study',
        activity_date: new Date().toISOString().split('T')[0],
        members_present: 1,
        total_attendance: 2,
        souls_saved: 0,
        activity_data: {
            student_name: "Test Student",
            book: "John",
            session_number: "1",
            format: ["Individual", "Face-to-Face"]
        }
    };

    const { data, error } = await supabase
        .from('activities')
        .insert(testData)
        .select();

    if (error) {
        console.error("Insert failed:", error.message);
    } else {
        console.log("Insert success:", data);
    }
}

testInsert();
