require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const companyId = process.argv[2] || 'global';
const port = process.env.MASTER_PORT || 2500;
const secret = process.env.DISCORD_REPORT_SECRET || '';

if (companyId !== 'global' && companyId !== 'webhook') {
    console.error('Usage: node restart-shard.js [global|webhook]');
    process.exit(1);
}

console.log(`Restarting shard "${companyId}"...`);

fetch(`http://localhost:${port}/admin/restart-shard`, {
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        'x-report-secret': secret,
    },
    body: JSON.stringify({ companyId }),
})
    .then(r => r.json())
    .then(data => {
        if (data.ok) {
            console.log(`Shard "${data.shardName}" restarted on port ${data.port} (ready=${data.ready})`);
        } else {
            console.error('Error:', data);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('Failed to connect to master:', err.message);
        process.exit(1);
    });
