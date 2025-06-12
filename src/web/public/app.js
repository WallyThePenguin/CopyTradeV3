// Chart instances
let performanceChart = null;
let assetClassChart = null;
let messagesChart = null;
let tradesChart = null;
let pnlSparkline = null;

// Current time period and mode
let currentPeriod = 'DAILY';
let currentMode = 'TEST';
let currentChannel = '';

// WebSocket for live signals
let signalsWebSocket = null;

// Dark theme chart defaults
Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = '#374151';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeLiveSignals();
    loadChannels(currentMode);
    updateStats(currentPeriod, currentMode);
    loadPositions();
    setInterval(() => updateStats(currentPeriod, currentMode), 30000); // Update every 30 seconds
    setInterval(loadPositions, 60000); // Refresh positions every minute
});

// Initialize live signals WebSocket
function initializeLiveSignals() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/signals`;
    
    try {
        signalsWebSocket = new WebSocket(wsUrl);
        
        signalsWebSocket.onmessage = (event) => {
            const signal = JSON.parse(event.data);
            displayLiveSignal(signal);
        };
        
        signalsWebSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        signalsWebSocket.onclose = () => {
            // Attempt to reconnect after 5 seconds
            setTimeout(initializeLiveSignals, 5000);
        };
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }
}

let loadedMode = null;
async function loadChannels(mode = 'ALL') {
    if (loadedMode === mode) return;
    loadedMode = mode;
    try {
        const res = await fetch(`/api/channels?mode=${mode}`);
        const channels = await res.json();
        const selector = document.getElementById('channelSelector');
        selector.innerHTML = '<option value="">All Channels</option>';
        channels.forEach(ch => {
            const opt = document.createElement('option');
            opt.value = ch.id;
            opt.textContent = ch.name;
            selector.appendChild(opt);
        });
        currentChannel = '';
    } catch (err) {
        console.error('Failed to load channels', err);
    }
}

function onChannelChange(channelId) {
    currentChannel = channelId;
    updateStats(currentPeriod, currentMode);
}

// Display live signal
function displayLiveSignal(signal) {
    const signalsContainer = document.getElementById('liveSignals');
    
    // Remove the "waiting for signals" message if it exists
    const waitingMessage = signalsContainer.querySelector('.text-gray-500');
    if (waitingMessage) {
        waitingMessage.remove();
    }
    
    // Create signal element
    const signalElement = document.createElement('div');
    signalElement.className = `signal-entry ${signal.action.toLowerCase()}`;
    
    const actionIcon = signal.action === 'BUY' ? '📈' : '📉';
    const confidenceClass = signal.confidence >= 0.8 ? 'text-green-400' : 'text-yellow-400';
    
    signalElement.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">${actionIcon}</span>
                <div>
                    <div class="font-bold text-white">
                        ${signal.symbol} ${signal.optionType ? `${signal.strikePrice} ${signal.optionType}` : ''}
                    </div>
                    <div class="text-sm text-gray-400">
                        ${signal.action} ${signal.entryPrice ? `@ $${signal.entryPrice}` : 'Market Order'}
                    </div>
                </div>
            </div>
            <div class="text-right">
                <div class="${confidenceClass} font-bold">
                    ${(signal.confidence * 100).toFixed(1)}%
                </div>
                <div class="text-xs text-gray-500">
                    ${new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    `;
    
    // Add to container (keep only last 10 signals)
    signalsContainer.insertBefore(signalElement, signalsContainer.firstChild);

    const signals = signalsContainer.querySelectorAll('.signal-entry');
    if (signals.length > 10) {
        signals[signals.length - 1].remove();
    }

    addDebugEntry(signal);
}

function addDebugEntry(signal) {
    const panel = document.getElementById('debugPanel');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${signal.action} ${signal.symbol} ${signal.optionType || ''} conf:${(signal.confidence*100).toFixed(1)}%`;
    panel.prepend(entry);
    const entries = panel.querySelectorAll('div');
    if (entries.length > 20) entries[entries.length-1].remove();
}

// Update statistics based on selected time period and mode
async function updateStats(period, mode) {
    currentPeriod = period;
    currentMode = mode;
    setPeriodAndModeLabels();
    updatePeriodButtons();
    updateModeButtons();
    loadChannels(mode);

    try {
        const channelParam = currentChannel ? `&channel=${currentChannel}` : '';
        const response = await fetch(`/api/stats?period=${period}&mode=${mode}${channelParam}`);
        const data = await response.json();

        updatePerformanceCards(data);
        updateCharts(data);
        updateTables(data);
        updateMetrics(data);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Update period selection buttons
function updatePeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-period') === currentPeriod) {
            btn.classList.add('active');
        }
    });
}

// Update mode selection buttons
function updateModeButtons() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-mode') === currentMode) {
            btn.classList.add('active');
        }
    });
}

// Update performance cards with animations
function updatePerformanceCards(data) {
    animateValue('winRate', `${(data.winRate * 100).toFixed(1)}%`);
    animateValue('totalPL', formatCurrency(data.totalPL), data.totalPL >= 0);
    animateValue('totalTrades', data.totalTrades);
    animateValue('avgDuration', formatDuration(data.avgTradeDuration));
}

// Animate value changes
function animateValue(elementId, newValue, isPositive = null) {
    const element = document.getElementById(elementId);
    element.textContent = newValue;
    
    if (isPositive !== null) {
        element.className = isPositive ? 'text-3xl font-bold text-profit' : 'text-3xl font-bold text-loss';
    }
    
    element.style.animation = 'none';
    setTimeout(() => {
        element.style.animation = 'pulse 0.5s ease-in-out';
    }, 10);
}

// Update charts
function updateCharts(data) {
    updatePerformanceChart(data.performanceHistory);
    updatePnlSparkline(data.performanceHistory);
    updateAssetClassChart(data.assetClassDistribution);
    updateMessagesChart(data.messageCountsOverTime);
    updateTradesChart(data.tradesCountsOverTime);
}

// Update performance chart with dark theme
function updatePerformanceChart(history) {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    if (performanceChart) {
        performanceChart.destroy();
    }

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.timestamp).toLocaleDateString()),
            datasets: [{
                label: 'Cumulative P/L',
                data: history.map(h => h.cumulativePL),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => {
                            return `P/L: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#9ca3af'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(55, 65, 81, 0.3)'
                    },
                    ticks: {
                        callback: value => formatCurrency(value),
                        color: '#9ca3af'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function updatePnlSparkline(history) {
    const ctx = document.getElementById('pnlSparkline').getContext('2d');
    if (pnlSparkline) pnlSparkline.destroy();
    pnlSparkline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.timestamp).toLocaleDateString()),
            datasets: [{
                data: history.map(h => h.cumulativePL),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16,185,129,0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

// Update asset class distribution chart with dark theme
function updateAssetClassChart(distribution) {
    const ctx = document.getElementById('assetClassChart').getContext('2d');

    if (assetClassChart) {
        assetClassChart.destroy();
    }

    assetClassChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                data: Object.values(distribution),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: '#1f2937',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        color: '#9ca3af'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12
                }
            }
        }
    });
}

// Update tables
function updateTables(data) {
    updateRecentTradesTable(data.recentTrades);
    updateTopTradersTable(data.topTraders);
}

// Update recent trades table with better styling
function updateRecentTradesTable(trades) {
    const tbody = document.querySelector('#recentTradesTable tbody');
    tbody.innerHTML = '';

    trades.forEach(trade => {
        const row = document.createElement('tr');
        const plClass = trade.profitLoss >= 0 ? 'text-profit' : 'text-loss';
        const actionIcon = trade.action === 'BUY' ? '📈' : '📉';

        row.innerHTML = `
            <td class="px-4 py-3">
                <span class="font-medium">${trade.symbol}</span>
                ${trade.optionType ? `<span class="text-xs text-gray-500 ml-1">${trade.optionType}</span>` : ''}
            </td>
            <td class="px-4 py-3">
                <span>${actionIcon} ${trade.action}</span>
            </td>
            <td class="px-4 py-3">${trade.channel?.name || '-'}</td>
            <td class="px-4 py-3">${trade.author || '-'}</td>
            <td class="px-4 py-3">${formatCurrency(trade.entryPrice)}</td>
            <td class="px-4 py-3">${trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}</td>
            <td class="px-4 py-3 ${plClass} font-medium">${trade.profitLoss ? formatCurrency(trade.profitLoss) : '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update top traders table with better styling
function updateTopTradersTable(traders) {
    const tbody = document.querySelector('#topTradersTable tbody');
    tbody.innerHTML = '';

    traders.forEach((trader, index) => {
        const row = document.createElement('tr');
        const plClass = trader.pl >= 0 ? 'text-profit' : 'text-loss';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        row.innerHTML = `
            <td class="px-4 py-3">
                <span>${medal}</span>
                <span class="font-medium">${trader.name}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center">
                    <div class="w-16 bg-gray-700 rounded-full h-2 mr-2">
                        <div class="bg-green-400 h-2 rounded-full" style="width: ${trader.winRate * 100}%"></div>
                    </div>
                    <span>${(trader.winRate * 100).toFixed(1)}%</span>
                </div>
            </td>
            <td class="px-4 py-3">${trader.totalTrades}</td>
            <td class="px-4 py-3 ${plClass} font-medium">${formatCurrency(trader.pl)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update metrics
function updateMetrics(data) {
    // Risk metrics
    document.getElementById('sharpeRatio').textContent = data.sharpeRatio.toFixed(2);
    document.getElementById('maxDrawdown').textContent = `${(data.maxDrawdown * 100).toFixed(1)}%`;
    document.getElementById('sortinoRatio').textContent = data.sortinoRatio.toFixed(2);

    // Channel stats
    document.getElementById('activeChannels').textContent = data.activeChannels;
    document.getElementById('totalChannels').textContent = data.totalChannels;
    document.getElementById('bestChannel').textContent = data.bestChannel;

    // Signal quality
    document.getElementById('signalAccuracy').textContent = `${(data.signalAccuracy * 100).toFixed(1)}%`;
    document.getElementById('avgLatency').textContent = `${data.avgLatency}ms`;
    document.getElementById('falsePositiveRate').textContent = `${(data.falsePositiveRate * 100).toFixed(1)}%`;
}

// Helper functions
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
}

// Add this function to set the period and mode labels
function setPeriodAndModeLabels() {
    const periodMap = {
        'DAILY': 'Daily',
        'WEEKLY': 'Weekly',
        'MONTHLY': 'Monthly',
        'ALL_TIME': 'All Time'
    };
    const modeMap = {
        'TEST': 'Simulated',
        'PROD': 'Production'
    };
    document.getElementById('currentPeriodLabel').textContent = `Time Period: ${periodMap[currentPeriod] || currentPeriod}`;
    document.getElementById('currentModeLabel').textContent = `Mode: ${modeMap[currentMode] || currentMode}`;
}

// Update messages chart with dark theme
function updateMessagesChart(messageCounts) {
    const ctx = document.getElementById('messagesChart').getContext('2d');
    if (messagesChart) {
        messagesChart.destroy();
    }
    messagesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: messageCounts.map(m => m.date),
            datasets: [{
                label: 'Messages',
                data: messageCounts.map(m => m.count),
                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(55, 65, 81, 0.3)'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
}

// Fetch and display open positions
async function loadPositions() {
    try {
        const res = await fetch('/api/positions');
        const data = await res.json();
        const positions = Array.isArray(data)
            ? data
            : Array.isArray(data.results)
                ? data.results
                : [];

        const tbody = document.querySelector('#positionsTable tbody');
        tbody.innerHTML = '';

        positions.forEach(pos => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-3">${pos.symbol || pos.instrument}</td>
                <td class="px-4 py-3">${pos.quantity}</td>
                <td class="px-4 py-3">${parseFloat(pos.average_buy_price || pos.averagePrice).toFixed(2)}</td>
                <td class="px-4 py-3">${parseFloat(pos.market_value || pos.equity || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Failed to load positions', err);
    }
}

// Update trades chart with dark theme
function updateTradesChart(tradesCounts) {
    const ctx = document.getElementById('tradesChart').getContext('2d');
    if (tradesChart) {
        tradesChart.destroy();
    }
    tradesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tradesCounts.map(t => t.date),
            datasets: [{
                label: 'Trades',
                data: tradesCounts.map(t => t.count),
                backgroundColor: 'rgba(245, 158, 11, 0.5)',
                borderColor: 'rgb(245, 158, 11)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(55, 65, 81, 0.3)'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
} 