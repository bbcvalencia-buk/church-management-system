import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

// Try standard supabase pooler
const connectionString = 'postgresql://postgres.ljblxpbssopkugmadnqj:N4ABybQYzJTx2VQa@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function runDeployments() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log("Connected successfully to direct PG instance!");

        const files = [
            'migration_church_events.sql',
            'migration_roles_to_enum.sql',
            'migration_roles_v2.sql',
            'migration_service_roles.sql',
            'migration_goodnews.sql',
            'migration_activities_data.sql',
            'migration_ss_departments.sql'
        ];

        for (const file of files) {
            if (fs.existsSync(file)) {
                console.log(`Running ${file}...`);
                const sql = fs.readFileSync(file, 'utf8');
                try {
                    await client.query(sql);
                    console.log(`✅ ${file} completed successfully.`);
                } catch (e) {
                    console.error(`❌ Error running ${file}:`, e.message);
                }
            } else {
                console.warn(`⚠️ File not found: ${file}`);
            }
        }
    } catch (err) {
        console.error("Connection failed:", err.message);
    } finally {
        await client.end();
    }
}

runDeployments();
