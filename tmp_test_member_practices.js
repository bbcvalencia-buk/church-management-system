import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Users\\Emman\\Desktop\\Church Systems\\Final Church Management\\.env' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    console.log('Fetching church positions for music ministry...');
    const { data: positions, error: e1 } = await supabase
        .from('church_positions')
        .select('member_id, department, position_name')
        .eq('position_category', 'music_ministry')
        .eq('is_active', true);

    console.log('Positions sample:', positions && positions.slice(0, 5));

    console.log('\nFetching music practice sessions...');
    const { data: sessions, error: e2 } = await supabase
        .from('music_practice_sessions')
        .select('id, practice_type, practice_date');

    console.log('Sessions sample:', sessions && sessions.slice(0, 5));
}
test();
