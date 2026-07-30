const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ljblxpbssopkugmadnqj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqYmx4cGJzc29wa3VnbWFkbnFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkyNjMyMSwiZXhwIjoyMDg3NTAyMzIxfQ.rXvT4xiV6cPIc5Yz05DwCcPzpkcCMjl0seP_lrXVJhI',
    { db: { schema: 'public' } }
);

async function run() {
    const { count, error } = await supabase.from('faith_promise_ledger').select('*', { count: 'exact', head: true });
    if (error) {
        console.log('Error querying faith_promise_ledger:', error.message);
    } else {
        console.log('faith_promise_ledger count:', count);
    }
}

run().catch(console.error);
