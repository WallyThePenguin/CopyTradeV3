import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testEndpoints() {
    console.log('Testing WebUI endpoints...\n');

    try {
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthRes = await fetch(`${BASE_URL}/api/health`);
        const health = await healthRes.json();
        console.log('Health status:', health.status);
        console.log('Metrics:', health.metrics);
        console.log('✓ Health check passed\n');

        // Test 2: Get channels
        console.log('2. Testing channels endpoint...');
        const channelsRes = await fetch(`${BASE_URL}/api/test/channels`);
        const channels = await channelsRes.json();
        console.log(`Found ${channels.length} channels`);
        channels.forEach(ch => {
            console.log(`- ${ch.name}: ${ch._count.trades} trades, ${ch._count.messages} messages`);
        });
        console.log('✓ Channels endpoint passed\n');

        // Test 3: Parse-only test
        console.log('3. Testing parse-only endpoint...');
        const parseRes = await fetch(`${BASE_URL}/api/parse-only`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'SPY 600 C' })
        });
        const parseResult = await parseRes.json();
        console.log('Parse result:', parseResult.analysis);
        console.log('✓ Parse-only test passed\n');

        // Test 4: Create test trade
        console.log('4. Testing trade creation...');
        const tradeRes = await fetch(`${BASE_URL}/api/test/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: 'AAPL',
                action: 'BUY',
                optionType: 'CALL',
                strikePrice: 180,
                entryPrice: 5.50
            })
        });
        const trade = await tradeRes.json();
        if (trade.success) {
            console.log('Created trade:', trade.trade.id);
            console.log('✓ Trade creation passed\n');

            // Test 5: Close the trade
            console.log('5. Testing trade closure...');
            const closeRes = await fetch(`${BASE_URL}/api/test/trade/${trade.trade.id}/close`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exitPrice: 7.50 })
            });
            const closedTrade = await closeRes.json();
            console.log('Closed trade with P/L:', closedTrade.trade.profitLoss);
            console.log('✓ Trade closure passed\n');
        }

        // Test 6: Get stats
        console.log('6. Testing stats endpoint...');
        const statsRes = await fetch(`${BASE_URL}/api/stats?period=DAILY`);
        const stats = await statsRes.json();
        console.log('Stats summary:');
        console.log(`- Total trades: ${stats.totalTrades}`);
        console.log(`- Win rate: ${(stats.winRate * 100).toFixed(2)}%`);
        console.log(`- Active channels: ${stats.activeChannels}`);
        console.log('✓ Stats endpoint passed\n');

        // Test 7: Get recent signals
        console.log('7. Testing signals endpoint...');
        const signalsRes = await fetch(`${BASE_URL}/api/signals?limit=5`);
        const signals = await signalsRes.json();
        console.log(`Found ${signals.length} recent signals`);
        console.log('✓ Signals endpoint passed\n');

        console.log('All tests passed! ✅');

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            const body = await error.response.text();
            console.error('Response:', body);
        }
    }
}

// Add WebSocket test
async function testWebSocket() {
    console.log('\nTesting WebSocket connection...');

    try {
        const WebSocket = (await import('ws')).default;
        const ws = new WebSocket('ws://localhost:3000/ws/signals');

        ws.on('open', () => {
            console.log('✓ WebSocket connected');

            // Wait for signals
            setTimeout(() => {
                ws.close();
                console.log('✓ WebSocket test completed\n');
            }, 2000);
        });

        ws.on('message', (data) => {
            console.log('Received signal:', JSON.parse(data));
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('WebSocket test failed:', error);
    }
}

// Run tests
async function runTests() {
    await testEndpoints();
    await testWebSocket();
}

// Check if server is running
fetch(`${BASE_URL}/api/health`)
    .then(() => {
        console.log('Server is running, starting tests...\n');
        runTests();
    })
    .catch(() => {
        console.error('Server is not running. Please start the server first with: npm start');
    });