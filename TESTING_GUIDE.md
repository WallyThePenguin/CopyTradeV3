# Testing Guide for CopyTradeV2

## Fixes Applied

### 1. Fixed Prisma Trade Creation Error
- **Issue**: The trade creation was failing with "channel argument is missing" error
- **Fix**: Updated `tradeTracker.js` to use Prisma's relation syntax:
  ```javascript
  channel: { connect: { id: channel.id } }
  ```

### 2. Database Initialization
- **Added**: `src/services/databaseInit.js` to ensure channels exist in database
- **Integration**: Automatically runs when application starts
- **Features**: 
  - Upserts all channels from config
  - Includes data cleanup function for old records

### 3. WebUI Server Improvements

#### Fixed Schema Mismatches:
- Updated trader statistics to use correct fields (`avgProfitLoss` instead of `profitLoss`)
- Fixed trade statistics to handle null `profitLoss` for open trades
- Removed references to non-existent fields like `isTestMode` and `isAccurate`
- Improved duration calculations to handle trades without exit times

#### Added Test Endpoints:
- `POST /api/test/trade` - Create test trades
- `PUT /api/test/trade/:id/close` - Close test trades
- `GET /api/test/channels` - View all channels with counts

#### Added CORS Support:
- Enabled cross-origin requests for development

#### Improved Error Handling:
- Better null checks and edge case handling
- Proper error messages for debugging

## Running Tests

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 3. Start the Application
```bash
npm start
```

### 4. Run WebUI Tests
In a new terminal:
```bash
npm test
```

## Test Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Create Test Trade
```bash
curl -X POST http://localhost:3000/api/test/trade \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "action": "BUY",
    "optionType": "CALL",
    "strikePrice": 180,
    "entryPrice": 5.50
  }'
```

### Parse Message (Dry Run)
```bash
curl -X POST http://localhost:3000/api/parse-only \
  -H "Content-Type: application/json" \
  -d '{"message": "SPY 600 C"}'
```

### Get Statistics
```bash
curl http://localhost:3000/api/stats?period=DAILY
```

### WebSocket Test
Connect to `ws://localhost:3000/ws/signals` to receive real-time trade signals.

## Monitoring

- Check console logs for any errors
- Use Prisma Studio to view database records
- WebSocket clients will receive signals when trades are created
- All test trades are marked with channel from your config

## Common Issues

1. **No channels found error**: Make sure the database is initialized and channels are imported from config
2. **Trade creation fails**: Check that at least one channel exists in the database
3. **Stats showing zeros**: Create some test trades first using the test endpoints
4. **WebSocket not connecting**: Ensure the server is running on port 3000

## Production Considerations

- Remove test endpoints before deploying to production
- Configure proper CORS settings for your domain
- Set up proper authentication for API endpoints
- Enable rate limiting for public endpoints
- Set up database backups and monitoring