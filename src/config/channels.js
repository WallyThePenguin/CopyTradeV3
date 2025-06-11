export const channels = {
    shortform: [
        // Quick trade channels
        {
            id: '1360474409487433738',
            name: 'MoeKhan Trading',
            checkInterval: 1000, // 1 second
            enabled: true,
            webhook_url: process.env.Webhook_URL, // Will be replaced with actual webhook URL
            min_confidence: 0.8, // Minimum confidence score for trade signals
            max_position_size: 1000, // Maximum position size in dollars
            enforce_symbols: false, // Enforce trading symbols
            allowed_symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT'] // Allowed trading symbols
        },
        {
            id: '1375771480037785640',
            name: 'Valid Testing',
            checkInterval: 1000, // 1 second
            enabled: true,
            webhook_url: process.env.Webhook_URL, // Will be replaced with actual webhook URL
            min_confidence: 0.8, // Minimum confidence score for trade signals
            max_position_size: 1000, // Maximum position size in dollars
            enforce_symbols: false, // Enforce trading symbols
            allowed_symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT'] // Allowed trading symbols
        },
    ],
    longform: [
        // Swing/long position channels
        {
            id: '1377489147094237315',
            name: 'Adam Trading',
            checkInterval: 60000, // 1 minute
            enabled: true,
            webhook_url: process.env.Webhook_URL, // Will be replaced with actual webhook URL
            min_confidence: 0.9, // Higher confidence required for long-term trades
            max_position_size: 5000, // Larger position size allowed for long-term trades
            enforce_symbols: false, // Enforce trading symbols
            allowed_symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'AMZN', 'GOOGL'] // More symbols allowed
        },
        {
            id: '1381919213421334538',
            name: 'Adam Testing',
            checkInterval: 1000, // 1 second
            enabled: true,
            webhook_url: process.env.Webhook_URL, // Will be replaced with actual webhook URL
            min_confidence: 0.8, // Minimum confidence score for trade signals
            max_position_size: 1000, // Maximum position size in dollars
            enforce_symbols: false, // Enforce trading symbols
            allowed_symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT'] // Allowed trading symbols
        }
    ]
};

export default channels;