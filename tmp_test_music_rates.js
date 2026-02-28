import dotenv from 'dotenv';
dotenv.config({ path: 'c:\\Users\\Emman\\Desktop\\Church Systems\\Final Church Management\\.env' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    console.log('Fetching practice events...');
    const { data: practices, error: e1 } = await supabase.from('music_practice_sessions').select('id, practice_type, practice_date');
    if (e1) { console.error(e1); return; }

    console.log('Total Practices:', practices.length);
    if (practices.length > 0) {
        console.log('Sample practice:', practices[0]);
    }

    console.log('\nFetching attendances...');
    const { data: att, error: e2 } = await supabase.from('attendance_log').select('member_id, event_id').eq('event_type', 'music_practice');
    if (e2) { console.error(e2); return; }

    console.log('Total Attendance Logs:', att.length);

    const counts = {};
    att.forEach(a => {
        counts[a.member_id] = (counts[a.member_id] || 0) + 1;
    });

    console.log('\nCounts:');
    let i = 0;
    for (const [mid, count] of Object.entries(counts)) {
        if (i++ < 5) {
            const rate = Math.round((count / practices.length) * 100);
            console.log(`Member ${mid}: Count=${count}, Total=${practices.length}, Rate=${rate}%`);
        }
    }

    console.log('\nFetching ministry members...');
    const { data: assignments, error: e3 } = await supabase.from('church_positions').select('member_id, department').eq('position_category', 'music_ministry');
    if (e3) { console.error(e3); return; }

    const choirMembers = assignments.filter(a => String(a.department).toLowerCase().includes('choir')).map(a => a.member_id);
    console.log('\nChoir Members Count:', choirMembers.length);

    let choirPractices = practices.filter(p => String(p.practice_type).toLowerCase().includes('choir'));
    console.log('Choir Practices:', choirPractices.length);

    console.log('\nChoir Rate for Member', choirMembers[0] || 'N/A');
    if (choirMembers.length > 0) {
        let countForMember = att.filter(a => a.member_id === choirMembers[0] && choirPractices.some(p => p.id === a.event_id)).length;
        let rate = Math.round((countForMember / Math.max(1, choirPractices.length)) * 100);
        console.log(`Count=${countForMember}, Total=${choirPractices.length}, Rate=${rate}%`);
    }
}
test();
