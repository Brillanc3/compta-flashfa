const { retryAllFailedLogs } = require('./src/modules/admin/admin.service');

async function test() {
    try {
        console.log("Starting retry for limited log types...");
        const result = await retryAllFailedLogs({ limit: 5 });
        console.log("Retry completed successfully:", result);
        process.exit(0);
    } catch (error) {
        console.error("Retry failed with error:", error);
        process.exit(1);
    }
}

test();
