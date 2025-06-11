import robinhoodService from './services/robinhood.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Force TESTING mode for this test
process.env.ENVIRONMENT = 'TESTING';

// Debug environment variables
console.log('Environment variables:');
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);

async function testRobinhood() {
    try {
        console.log('\nTesting Robinhood Simulator...');

        // Test simulated stock order
        console.log('\nTesting simulated stock order...');
        const stockOrder = {
            symbol: 'QQQ',
            type: 'limit',
            time_in_force: 'gfd',
            trigger: 'immediate',
            price: '508.00',
            quantity: 1,
            side: 'buy'
        };

        const stockOrderResult = await robinhoodService.placeOrder(stockOrder);
        console.log('Stock Order Result:', JSON.stringify(stockOrderResult, null, 2));

        // Test simulated option order
        console.log('\nTesting simulated option order...');
        const optionOrder = {
            symbol: 'QQQ',
            type: 'limit',
            time_in_force: 'gfd',
            trigger: 'immediate',
            price: '2.50',
            quantity: 1,
            side: 'buy',
            option_type: 'PUT',
            strike_price: 508,
            expiration_date: '2024-03-15'
        };

        const optionOrderResult = await robinhoodService.placeOptionOrder(optionOrder);
        console.log('Option Order Result:', JSON.stringify(optionOrderResult, null, 2));

        // Test order cancellation
        if (stockOrderResult.id) {
            console.log('\nTesting order cancellation...');
            const cancelResult = await robinhoodService.cancelOrder(stockOrderResult.id);
            console.log('Cancel Result:', JSON.stringify(cancelResult, null, 2));
        }

        console.log('\nAll simulation tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testRobinhood(); 