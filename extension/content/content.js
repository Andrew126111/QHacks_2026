// Content script that injects into any trading website
(function() {
    'use strict';

    let panel = null;
    let isPanelVisible = false;
    let isEnabled = false;

    // Check if current site is a trading platform
    function isTradingSite() {
        const hostname = window.location.hostname.toLowerCase();
        const tradingKeywords = [
            'tradingview', 'binance', 'coinbase', 'kraken', 'etoro', 'robinhood',
            'interactive brokers', 'td ameritrade', 'schwab', 'fidelity',
            'webull', 'tastytrade', 'thinkorswim', 'metatrader', 'mt4', 'mt5',
            'trading', 'forex', 'crypto', 'stock', 'broker', 'exchange'
        ];
        
        // Check URL and page content for trading-related keywords
        const pageText = document.body.innerText.toLowerCase();
        const hasTradingContent = tradingKeywords.some(keyword => 
            hostname.includes(keyword) || pageText.includes(keyword)
        );
        
        return hasTradingContent;
    }

    // Create and inject the bias detector panel
    function createPanel() {
        // Only show on trading-related sites or if user explicitly enables it
        if (!isTradingSite() && !isEnabled) {
            // Check if user wants to enable on this site
            chrome.storage.local.get(['enableOnAllSites'], (result) => {
                if (result.enableOnAllSites) {
                    isEnabled = true;
                    injectPanel();
                }
            });
            return;
        }
        
        injectPanel();
    }

    function injectPanel() {
        if (panel) return;

        // Create panel container
        panel = document.createElement('div');
        panel.id = 'bias-detector-panel';
        panel.innerHTML = `
            <div class="bias-panel-header">
                <h3>🏦 Bias Detector</h3>
                <button id="bias-panel-toggle" class="bias-toggle-btn">−</button>
            </div>
            <div class="bias-panel-content" id="bias-panel-content">
            <div class="bias-loading" id="bias-loading">
                <p>Click "Analyze Trades" to detect biases</p>
                <p style="font-size: 10px; color: #787b86; margin-top: 5px;">
                    Works on any trading platform!
                </p>
            </div>
            <div class="bias-controls">
                <button id="bias-analyze-btn" class="bias-btn-primary">Analyze Trades</button>
                <button id="bias-upload-btn" class="bias-btn-secondary">Upload CSV</button>
                <input type="file" id="bias-file-input" accept=".csv" style="display: none;">
            </div>
                <div id="bias-results" style="display: none;"></div>
            </div>
        `;

        // Inject panel into page
        document.body.appendChild(panel);

        // Add event listeners
        document.getElementById('bias-panel-toggle').addEventListener('click', togglePanel);
        document.getElementById('bias-analyze-btn').addEventListener('click', analyzeTrades);
        document.getElementById('bias-upload-btn').addEventListener('click', () => {
            document.getElementById('bias-file-input').click();
        });
        document.getElementById('bias-file-input').addEventListener('change', handleFileUpload);

        // Try to extract trades from current trading platform
        extractTradesFromPage();
    }

    function togglePanel() {
        const content = document.getElementById('bias-panel-content');
        const toggleBtn = document.getElementById('bias-panel-toggle');
        
        if (isPanelVisible) {
            content.style.display = 'none';
            toggleBtn.textContent = '+';
            isPanelVisible = false;
        } else {
            content.style.display = 'block';
            toggleBtn.textContent = '−';
            isPanelVisible = true;
        }
    }

    // Extract trades from current trading platform
    function extractTradesFromPage() {
        const trades = [];
        const hostname = window.location.hostname.toLowerCase();
        
        console.log('Bias Detector: Looking for trade data on', hostname);
        
        // Try to find common trading data patterns across different platforms
        // Look for tables, lists, or data structures that might contain trade history
        
        // Common selectors for trade history tables
        const tradeSelectors = [
            '[class*="trade"]',
            '[class*="order"]',
            '[class*="position"]',
            '[class*="history"]',
            '[id*="trade"]',
            '[id*="order"]',
            'table tbody tr',
            '[data-testid*="trade"]'
        ];
        
        // Try to extract data from various trading platforms
        try {
            // Generic approach: look for tables with P/L columns
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
                const headers = Array.from(table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td'))
                    .map(h => h.textContent.toLowerCase());
                
                const plIndex = headers.findIndex(h => 
                    h.includes('p/l') || h.includes('pnl') || h.includes('profit') || h.includes('loss')
                );
                const timeIndex = headers.findIndex(h => 
                    h.includes('time') || h.includes('date') || h.includes('timestamp')
                );
                const actionIndex = headers.findIndex(h => 
                    h.includes('buy') || h.includes('sell') || h.includes('side') || h.includes('type')
                );
                
                if (plIndex !== -1 && timeIndex !== -1) {
                    const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                    rows.forEach(row => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        if (cells.length > Math.max(plIndex, timeIndex)) {
                            const pl = parseFloat(cells[plIndex]?.textContent?.replace(/[^0-9.-]/g, '') || '0');
                            const timestamp = cells[timeIndex]?.textContent?.trim() || new Date().toISOString();
                            const action = cells[actionIndex]?.textContent?.trim() || 'Buy';
                            
                            if (!isNaN(pl) && pl !== 0) {
                                trades.push({
                                    timestamp: timestamp,
                                    action: action,
                                    asset: 'Unknown',
                                    pl: pl
                                });
                            }
                        }
                    });
                }
            });
        } catch (error) {
            console.log('Bias Detector: Could not auto-extract trades:', error);
        }
        
        // Store extracted trades
        if (trades.length > 0) {
            chrome.storage.local.set({ extractedTrades: trades });
            console.log('Bias Detector: Found', trades.length, 'potential trades');
        }
    }

    async function analyzeTrades() {
        const loadingEl = document.getElementById('bias-loading');
        const resultsEl = document.getElementById('bias-results');
        
        loadingEl.innerHTML = '<p>Analyzing trades...</p>';
        resultsEl.style.display = 'none';

        // Get trades from storage or prompt user
        const data = await chrome.storage.local.get(['trades', 'extractedTrades']);
        let trades = data.trades || data.extractedTrades || [];

        if (trades.length === 0) {
            // Try to extract trades from current page
            extractTradesFromPage();
            const data = await chrome.storage.local.get(['extractedTrades']);
            trades = data.extractedTrades || [];
            
            if (trades.length === 0) {
                loadingEl.innerHTML = `
                    <p style="color: #ff4757;">No trades found.</p>
                    <p style="font-size: 11px; margin-top: 8px;">
                        Upload a CSV file with your trading data, or the extension will try to extract trades from tables on this page.
                    </p>
                `;
                return;
            } else {
                loadingEl.innerHTML = `<p>Found ${trades.length} trades. Analyzing...</p>`;
            }
        }

        // Analyze using BiasDetector
        const detector = new BiasDetector(trades);
        
        const results = {
            overtrading: detector.detectOvertrading(),
            loss_aversion: detector.detectLossAversion(),
            revenge_trading: detector.detectRevengeTrading(),
            summary: detector.generateSummary(),
            recommendations: detector.generateRecommendations(),
            statistics: detector.getStatistics()
        };

        displayResults(results);
        loadingEl.style.display = 'none';
        resultsEl.style.display = 'block';
    }

    function promptManualEntry() {
        // For now, return empty - we'll add a proper UI for manual entry
        // Or use the CSV upload functionality
        return [];
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const csv = e.target.result;
            const trades = parseCSV(csv);
            
            chrome.storage.local.set({ trades: trades }, () => {
                analyzeTrades();
            });
        };
        reader.readAsText(file);
    }

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const timestampIdx = headers.findIndex(h => h.includes('timestamp'));
        const actionIdx = headers.findIndex(h => h.includes('buy') || h.includes('sell') || h.includes('action'));
        const assetIdx = headers.findIndex(h => h.includes('asset') || h.includes('symbol'));
        const plIdx = headers.findIndex(h => h.includes('p/l') || h.includes('pnl') || h.includes('profit'));

        if (timestampIdx === -1 || actionIdx === -1 || assetIdx === -1 || plIdx === -1) {
            alert('CSV must contain: Timestamp, Buy/sell, Asset, P/L');
            return [];
        }

        const trades = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length > Math.max(timestampIdx, actionIdx, assetIdx, plIdx)) {
                trades.push({
                    timestamp: values[timestampIdx],
                    action: values[actionIdx],
                    asset: values[assetIdx],
                    pl: parseFloat(values[plIdx]) || 0
                });
            }
        }

        return trades;
    }

    function displayResults(results) {
        const resultsEl = document.getElementById('bias-results');
        
        const summary = results.summary;
        const stats = results.statistics;

        let html = `
            <div class="bias-summary">
                <h4>Trading Summary</h4>
                <div class="bias-stats-grid">
                    <div class="bias-stat">
                        <div class="bias-stat-value">${stats.total_trades}</div>
                        <div class="bias-stat-label">Total Trades</div>
                    </div>
                    <div class="bias-stat">
                        <div class="bias-stat-value">$${stats.total_pnl.toFixed(2)}</div>
                        <div class="bias-stat-label">Total P&L</div>
                    </div>
                    <div class="bias-stat">
                        <div class="bias-stat-value">${stats.win_rate}%</div>
                        <div class="bias-stat-label">Win Rate</div>
                    </div>
                    <div class="bias-stat">
                        <div class="bias-stat-value">${summary.bias_count}</div>
                        <div class="bias-stat-label">Biases Detected</div>
                    </div>
                </div>
            </div>

            <div class="bias-detections">
                ${createBiasCard('Overtrading', results.overtrading)}
                ${createBiasCard('Loss Aversion', results.loss_aversion)}
                ${createBiasCard('Revenge Trading', results.revenge_trading)}
            </div>

            <div class="bias-recommendations">
                <h4>Recommendations</h4>
                ${results.recommendations.map(rec => `
                    <div class="bias-rec-item priority-${rec.priority.toLowerCase()}">
                        <strong>${rec.bias}</strong> - ${rec.recommendation}
                    </div>
                `).join('')}
            </div>
        `;

        resultsEl.innerHTML = html;
    }

    function createBiasCard(title, bias) {
        if (!bias.detected) {
            return `
                <div class="bias-card">
                    <h5>${title}</h5>
                    <span class="bias-badge bias-low">Not Detected</span>
                    <p>${bias.description}</p>
                </div>
            `;
        }

        const severityClass = `bias-${bias.severity.toLowerCase()}`;
        const scoreClass = `score-${bias.severity.toLowerCase()}`;

        let metricsHtml = '';
        if (bias.metrics && Object.keys(bias.metrics).length > 0) {
            metricsHtml = '<ul class="bias-metrics">';
            for (const [key, value] of Object.entries(bias.metrics)) {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                metricsHtml += `<li><span>${label}:</span> <strong>${value}</strong></li>`;
            }
            metricsHtml += '</ul>';
        }

        return `
            <div class="bias-card">
                <h5>${title}</h5>
                <span class="bias-badge ${severityClass}">${bias.severity} Severity</span>
                <div class="bias-score-bar">
                    <div class="bias-score-fill ${scoreClass}" style="width: ${bias.score}%"></div>
                </div>
                <p>${bias.description}</p>
                ${metricsHtml}
            </div>
        `;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'togglePanel') {
            isEnabled = request.enabled;
            if (request.enabled && !panel) {
                createPanel();
            } else if (!request.enabled && panel && !isTradingSite()) {
                if (panel) {
                    panel.remove();
                    panel = null;
                }
            }
            sendResponse({ success: true });
        }
        return true;
    });

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPanel);
    } else {
        createPanel();
    }

    // Also listen for navigation changes (many trading sites are SPAs)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => {
                if (panel) {
                    panel.remove();
                    panel = null;
                }
                createPanel();
            }, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();
