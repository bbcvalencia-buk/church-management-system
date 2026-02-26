import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ljblxpbssopkugmadnqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqYmx4cGJzc29wa3VnbWFkbnFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkyNjMyMSwiZXhwIjoyMDg3NTAyMzIxfQ.rXvT4xiV6cPIc5Yz05DwCcPzpkcCMjl0seP_lrXVJhI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('church_events').select('id').limit(1);
    if (error) {
        console.error('Error fetching church_events:', error);
    } else {
        console.log('Success fetching church_events:', data);
    }
}

test();
