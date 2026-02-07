// Load saved preference
chrome.storage.local.get(['enableOnAllSites'], (result) => {
    if (result.enableOnAllSites) {
        document.getElementById('enableAllSites').checked = true;
    }
});

document.getElementById('enableAllSites').addEventListener('change', (e) => {
    chrome.storage.local.set({ enableOnAllSites: e.target.checked });
    
    // Notify content script to show/hide panel
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'togglePanel', 
            enabled: e.target.checked 
        });
    });
});

document.getElementById('openTradingSite').addEventListener('click', () => {
    // Open a popular trading platform
    chrome.tabs.create({ url: 'https://www.tradingview.com' });
});

document.getElementById('uploadCSV').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const csv = event.target.result;
            const trades = parseCSV(csv);
            
            chrome.storage.local.set({ trades: trades }, () => {
                chrome.tabs.create({ url: 'https://www.tradingview.com' });
            });
        };
        reader.readAsText(file);
    }
});

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
