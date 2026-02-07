let tradingData = [];

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const csv = event.target.result;
            parseCSV(csv);
        };
        reader.readAsText(file);
    }
});

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Find column indices
    const timestampIdx = headers.findIndex(h => h.toLowerCase().includes('timestamp'));
    const actionIdx = headers.findIndex(h => h.toLowerCase().includes('buy') || h.toLowerCase().includes('sell') || h.toLowerCase().includes('action'));
    const assetIdx = headers.findIndex(h => h.toLowerCase().includes('asset') || h.toLowerCase().includes('symbol'));
    const plIdx = headers.findIndex(h => h.toLowerCase().includes('p/l') || h.toLowerCase().includes('pnl') || h.toLowerCase().includes('profit'));
    
    if (timestampIdx === -1 || actionIdx === -1 || assetIdx === -1 || plIdx === -1) {
        alert('CSV must contain columns: Timestamp, Buy/sell (or Action), Asset (or Symbol), P/L (or PnL or Profit)');
        return;
    }
    
    tradingData = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            tradingData.push({
                'Timestamp': values[timestampIdx],
                'Buy/sell': values[actionIdx],
                'Asset': values[assetIdx],
                'P/L': parseFloat(values[plIdx]) || 0
            });
        }
    }
    
    if (tradingData.length > 0) {
        analyzeData();
    }
}

async function loadMockData() {
    showLoading();
    try {
        const response = await fetch('/api/mock-data');
        const data = await response.json();
        tradingData = data.trades;
        analyzeData();
    } catch (error) {
        console.error('Error loading mock data:', error);
        alert('Error loading mock data');
        hideLoading();
    }
}

async function analyzeData() {
    showLoading();
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trades: tradingData })
        });
        
        const results = await response.json();
        
        if (results.error) {
            alert('Error: ' + results.error);
            hideLoading();
            return;
        }
        
        displayResults(results);
        hideLoading();
    } catch (error) {
        console.error('Error analyzing data:', error);
        alert('Error analyzing data: ' + error.message);
        hideLoading();
    }
}

function displayResults(results) {
    document.getElementById('results').style.display = 'block';
    
    // Display summary
    displaySummary(results.summary, results.statistics);
    
    // Display biases
    displayBias('overtradingCard', results.overtrading, 'Overtrading');
    displayBias('lossAversionCard', results.loss_aversion, 'Loss Aversion');
    displayBias('revengeTradingCard', results.revenge_trading, 'Revenge Trading');
    
    // Display recommendations
    displayRecommendations(results.recommendations);
    
    // Display charts
    displayCharts(results);
}

function displaySummary(summary, stats) {
    const summaryHTML = `
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-value">${stats.total_trades}</div>
                <div class="stat-label">Total Trades</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">$${stats.total_pnl.toFixed(2)}</div>
                <div class="stat-label">Total P&L</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.win_rate}%</div>
                <div class="stat-label">Win Rate</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${summary.bias_count}</div>
                <div class="stat-label">Biases Detected</div>
            </div>
        </div>
        ${summary.biases_detected.length > 0 ? 
            `<p style="margin-top: 20px; color: #ff4757; font-weight: bold;">
                ⚠️ Detected Biases: ${summary.biases_detected.join(', ')}
            </p>` : 
            '<p style="margin-top: 20px; color: #2ed573; font-weight: bold;">✓ No significant biases detected</p>'
        }
    `;
    document.getElementById('summaryContent').innerHTML = summaryHTML;
}

function displayBias(cardId, bias, title) {
    const card = document.getElementById(cardId);
    const content = card.querySelector('.bias-content');
    
    if (!bias.detected) {
        content.innerHTML = `
            <span class="severity-badge severity-low">Not Detected</span>
            <p style="color: #666; margin-top: 10px;">${bias.description || 'No significant patterns detected.'}</p>
        `;
        return;
    }
    
    const severityClass = `severity-${bias.severity.toLowerCase()}`;
    const scoreClass = `score-${bias.severity.toLowerCase()}`;
    
    let metricsHTML = '';
    if (bias.metrics) {
        metricsHTML = '<ul class="metrics-list">';
        for (const [key, value] of Object.entries(bias.metrics)) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            metricsHTML += `<li><span>${label}:</span> <strong>${value}</strong></li>`;
        }
        metricsHTML += '</ul>';
    }
    
    content.innerHTML = `
        <span class="severity-badge ${severityClass}">${bias.severity} Severity</span>
        <div class="score-bar">
            <div class="score-fill ${scoreClass}" style="width: ${bias.score}%"></div>
        </div>
        <p style="color: #666; margin: 15px 0;">${bias.description}</p>
        ${metricsHTML}
    `;
}

function displayRecommendations(recommendations) {
    const container = document.getElementById('recommendationsContent');
    
    if (recommendations.length === 0) {
        container.innerHTML = '<p style="color: #666;">No specific recommendations at this time. Keep up the good trading discipline!</p>';
        return;
    }
    
    let html = '';
    recommendations.forEach(rec => {
        const priorityClass = `priority-${rec.priority.toLowerCase()}`;
        html += `
            <div class="recommendation-item ${priorityClass}">
                <h4>${rec.bias} - ${rec.priority} Priority</h4>
                <p>${rec.recommendation}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayCharts(results) {
    const container = document.getElementById('chartsContainer');
    
    // P/L Over Time Chart
    const plData = tradingData.map((trade, idx) => ({
        x: idx + 1,
        y: trade['P/L'],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'P/L',
        marker: { color: tradingData.map(t => t['P/L'] >= 0 ? '#2ed573' : '#ff4757') }
    }));
    
    const plTrace = {
        x: Array.from({length: tradingData.length}, (_, i) => i + 1),
        y: tradingData.map(t => t['P/L']),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'P/L',
        marker: { 
            color: tradingData.map(t => t['P/L'] >= 0 ? '#2ed573' : '#ff4757'),
            size: 8
        },
        line: { color: '#667eea', width: 2 }
    };
    
    const plLayout = {
        title: 'P/L Over Time',
        xaxis: { title: 'Trade Number' },
        yaxis: { title: 'Profit/Loss ($)' },
        hovermode: 'closest',
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('plChart', [plTrace], plLayout, {responsive: true});
    
    // Bias Scores Chart
    const biasScores = [
        { name: 'Overtrading', score: results.overtrading.score },
        { name: 'Loss Aversion', score: results.loss_aversion.score },
        { name: 'Revenge Trading', score: results.revenge_trading.score }
    ];
    
    const biasTrace = {
        x: biasScores.map(b => b.name),
        y: biasScores.map(b => b.score),
        type: 'bar',
        marker: {
            color: biasScores.map(b => {
                if (b.score < 30) return '#2ed573';
                if (b.score < 60) return '#ffa502';
                return '#ff4757';
            })
        }
    };
    
    const biasLayout = {
        title: 'Bias Detection Scores',
        xaxis: { title: 'Bias Type' },
        yaxis: { title: 'Severity Score (0-100)', range: [0, 100] },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('biasChart', [biasTrace], biasLayout, {responsive: true});
    
    // Win/Loss Distribution
    const winLossData = {
        x: ['Wins', 'Losses'],
        y: [results.statistics.winning_trades, results.statistics.losing_trades],
        type: 'bar',
        marker: {
            color: ['#2ed573', '#ff4757']
        }
    };
    
    const winLossLayout = {
        title: 'Win/Loss Distribution',
        xaxis: { title: 'Trade Outcome' },
        yaxis: { title: 'Number of Trades' },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('winLossChart', [winLossData], winLossLayout, {responsive: true});
    
    container.innerHTML = `
        <div class="chart-container">
            <div id="plChart"></div>
        </div>
        <div class="chart-container">
            <div id="biasChart"></div>
        </div>
        <div class="chart-container">
            <div id="winLossChart"></div>
        </div>
    `;
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}
