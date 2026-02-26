import { execSync } from 'child_process';

const scripts = [
    'members',
    'financial',
    'faith-promise',
    'attendance',
    'visitors',
    'church-positions',
    'user-roles'
];

async function runAll() {
    console.log('🚀 Starting Full Migration (V1 -> V2)...');
    console.log('=========================================');

    for (const script of scripts) {
        console.log(`\n⏳ Running migrate-${script}.js...`);
        try {
            execSync(`node scripts/migrate-${script}.js`, { stdio: 'inherit' });
            console.log(`✅ Completed migrate-${script}.js`);

            // Delay between scripts as requested
            console.log('💤 Waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`❌ Error in migrate-${script}.js:`, error.message);
            console.log('Continuing with next script...');
        }
    }

    console.log('\n=========================================');
    console.log('🏁 Full Migration Complete!');
    console.log('Check scripts/logs/ for detailed reports.');
}

runAll();
