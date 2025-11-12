import robinhoodService from '../src/services/robinhood.js';

async function main() {
    try {
        await robinhoodService.initialize(true);
        const account = await robinhoodService.getAccountInfo();
        console.log('Account snapshot:\n', JSON.stringify(account, null, 2));

        const positions = await robinhoodService.getPositions();
        console.log(
            '\nPositions:',
            JSON.stringify(positions, null, 2)
        );
        process.exit(0);
    } catch (error) {
        console.error('Failed to fetch account info:', error);
        process.exit(1);
    }
}

main();
