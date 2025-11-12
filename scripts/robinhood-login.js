import robinhoodService from '../src/services/robinhood.js';

async function main() {
    console.log('Starting manual Robinhood login...\n');
    const success = await robinhoodService.manualLogin();
    if (success) {
        console.log('\nManual login succeeded. Token cached.');
        process.exit(0);
    } else {
        console.error('\nManual login failed. See logs for details.');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Manual login failed:', error);
    process.exit(1);
});
