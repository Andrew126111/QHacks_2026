// Bias Detector - JavaScript implementation
class BiasDetector {
    constructor(trades) {
        this.trades = trades.map(t => ({
            ...t,
            timestamp: new Date(t.timestamp || t.Timestamp),
            pl: parseFloat(t.pl || t['P/L'] || 0),
            action: t.action || t['Buy/sell'] || 'Buy',
            asset: t.asset || t.Asset || 'Unknown'
        })).filter(t => !isNaN(t.timestamp.getTime()) && !isNaN(t.pl))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate additional metrics
        this.trades.forEach(t => {
            t.isLoss = t.pl < 0;
            t.isWin = t.pl > 0;
            t.date = t.timestamp.toISOString().split('T')[0];
        });
    }

    detectOvertrading() {
        if (this.trades.length === 0) {
            return this._emptyResult('Overtrading');
        }

        // Group trades by date
        const tradesByDate = {};
        this.trades.forEach(t => {
            if (!tradesByDate[t.date]) tradesByDate[t.date] = [];
            tradesByDate[t.date].push(t);
        });

        const tradesPerDay = Object.values(tradesByDate).map(arr => arr.length);
        const avgTradesPerDay = tradesPerDay.reduce((a, b) => a + b, 0) / tradesPerDay.length;
        const maxTradesPerDay = Math.max(...tradesPerDay);

        // Calculate time differences
        const timeDiffs = [];
        for (let i = 1; i < this.trades.length; i++) {
            const diff = (this.trades[i].timestamp - this.trades[i-1].timestamp) / (1000 * 60); // minutes
            if (diff > 0) timeDiffs.push(diff);
        }
        const avgTimeBetween = timeDiffs.length > 0 
            ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length 
            : 0;

        // Rapid trades (within 5 minutes)
        const rapidTrades = timeDiffs.filter(d => d < 5).length;
        const rapidTradePct = (rapidTrades / this.trades.length) * 100;

        const winRate = (this.trades.filter(t => t.isWin).length / this.trades.length) * 100;

        // Score calculation
        let score = 0;
        const thresholdAvg = 10;
        const thresholdMax = 20;

        if (avgTradesPerDay > thresholdAvg) {
            score += Math.min(40, (avgTradesPerDay / thresholdAvg) * 20);
        }
        if (maxTradesPerDay > thresholdMax) {
            score += Math.min(30, (maxTradesPerDay / thresholdMax) * 15);
        }
        if (rapidTradePct > 30) {
            score += Math.min(30, (rapidTradePct / 30) * 15);
        }

        const severity = score < 30 ? 'Low' : score < 60 ? 'Moderate' : 'High';

        return {
            detected: score > 25,
            severity: severity,
            score: Math.min(100, Math.round(score * 10) / 10),
            metrics: {
                avg_trades_per_day: Math.round(avgTradesPerDay * 100) / 100,
                max_trades_per_day: maxTradesPerDay,
                rapid_trade_percentage: Math.round(rapidTradePct * 10) / 10,
                avg_minutes_between_trades: Math.round(avgTimeBetween * 10) / 10,
                win_rate: Math.round(winRate * 10) / 10
            },
            description: this._getOvertradingDescription(severity, avgTradesPerDay, rapidTradePct)
        };
    }

    detectLossAversion() {
        const wins = this.trades.filter(t => t.isWin);
        const losses = this.trades.filter(t => t.isLoss);

        if (wins.length === 0 || losses.length === 0) {
            return {
                detected: false,
                severity: 'Low',
                score: 0,
                metrics: {},
                description: 'Insufficient data to detect loss aversion patterns.'
            };
        }

        const avgWin = wins.reduce((sum, t) => sum + t.pl, 0) / wins.length;
        const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pl, 0) / losses.length);
        const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

        const winRate = (wins.length / this.trades.length) * 100;
        const largestWin = Math.max(...wins.map(t => t.pl));
        const largestLoss = Math.abs(Math.min(...losses.map(t => t.pl)));

        let score = 0;
        if (riskRewardRatio < 1.0) {
            score += 40;
        } else if (riskRewardRatio < 1.5) {
            score += 20;
        }
        if (winRate > 60 && riskRewardRatio < 1.2) {
            score += 30;
        }
        if (largestLoss > largestWin * 2) {
            score += 30;
        }

        const severity = score < 30 ? 'Low' : score < 60 ? 'Moderate' : 'High';

        return {
            detected: score > 25,
            severity: severity,
            score: Math.min(100, Math.round(score * 10) / 10),
            metrics: {
                risk_reward_ratio: Math.round(riskRewardRatio * 100) / 100,
                avg_win: Math.round(avgWin * 100) / 100,
                avg_loss: Math.round(avgLoss * 100) / 100,
                win_rate: Math.round(winRate * 10) / 10,
                largest_win: Math.round(largestWin * 100) / 100,
                largest_loss: Math.round(largestLoss * 100) / 100
            },
            description: this._getLossAversionDescription(severity, riskRewardRatio, winRate)
        };
    }

    detectRevengeTrading() {
        if (this.trades.length < 2) {
            return {
                detected: false,
                severity: 'Low',
                score: 0,
                metrics: {},
                description: 'Insufficient data to detect revenge trading patterns.'
            };
        }

        // Calculate time differences and previous loss status
        const afterLoss = [];
        const afterWin = [];

        for (let i = 1; i < this.trades.length; i++) {
            const prevTrade = this.trades[i - 1];
            const currTrade = this.trades[i];
            const timeDiff = (currTrade.timestamp - prevTrade.timestamp) / (1000 * 60); // minutes

            if (prevTrade.isLoss) {
                afterLoss.push({ ...currTrade, timeSincePrev: timeDiff });
            } else {
                afterWin.push({ ...currTrade, timeSincePrev: timeDiff });
            }
        }

        if (afterLoss.length === 0) {
            return {
                detected: false,
                severity: 'Low',
                score: 0,
                metrics: {},
                description: 'No consecutive loss patterns detected.'
            };
        }

        const avgTimeAfterLoss = afterLoss.reduce((sum, t) => sum + t.timeSincePrev, 0) / afterLoss.length;
        const avgTimeAfterWin = afterWin.length > 0 
            ? afterWin.reduce((sum, t) => sum + t.timeSincePrev, 0) / afterWin.length 
            : avgTimeAfterLoss;

        const rapidAfterLoss = afterLoss.filter(t => t.timeSincePrev < 30).length;
        const rapidAfterLossPct = (rapidAfterLoss / afterLoss.length) * 100;

        const avgAbsPlAfterLoss = afterLoss.reduce((sum, t) => sum + Math.abs(t.pl), 0) / afterLoss.length;
        const avgAbsPlAfterWin = afterWin.length > 0
            ? afterWin.reduce((sum, t) => sum + Math.abs(t.pl), 0) / afterWin.length
            : avgAbsPlAfterLoss;

        const winRateAfterLoss = (afterLoss.filter(t => t.isWin).length / afterLoss.length) * 100;

        let score = 0;
        if (avgTimeAfterLoss < avgTimeAfterWin * 0.5) {
            score += 40;
        }
        if (rapidAfterLossPct > 50) {
            score += 30;
        }
        if (avgAbsPlAfterLoss > avgAbsPlAfterWin * 1.3) {
            score += 20;
        }
        if (winRateAfterLoss < 40) {
            score += 20;
        }

        const severity = score < 30 ? 'Low' : score < 60 ? 'Moderate' : 'High';

        return {
            detected: score > 25,
            severity: severity,
            score: Math.min(100, Math.round(score * 10) / 10),
            metrics: {
                avg_minutes_after_loss: Math.round(avgTimeAfterLoss * 10) / 10,
                avg_minutes_after_win: Math.round(avgTimeAfterWin * 10) / 10,
                rapid_trade_after_loss_pct: Math.round(rapidAfterLossPct * 10) / 10,
                win_rate_after_loss: Math.round(winRateAfterLoss * 10) / 10,
                avg_abs_pl_after_loss: Math.round(avgAbsPlAfterLoss * 100) / 100,
                avg_abs_pl_after_win: Math.round(avgAbsPlAfterWin * 100) / 100
            },
            description: this._getRevengeTradingDescription(severity, rapidAfterLossPct, winRateAfterLoss)
        };
    }

    generateSummary() {
        const totalTrades = this.trades.length;
        const totalPnL = this.trades.reduce((sum, t) => sum + t.pl, 0);
        const winRate = (this.trades.filter(t => t.isWin).length / totalTrades) * 100;

        const biases = [];
        if (this.detectOvertrading().detected) biases.push('Overtrading');
        if (this.detectLossAversion().detected) biases.push('Loss Aversion');
        if (this.detectRevengeTrading().detected) biases.push('Revenge Trading');

        return {
            total_trades: totalTrades,
            total_pnl: Math.round(totalPnL * 100) / 100,
            win_rate: Math.round(winRate * 10) / 10,
            biases_detected: biases,
            bias_count: biases.length
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const overtrading = this.detectOvertrading();
        const lossAversion = this.detectLossAversion();
        const revengeTrading = this.detectRevengeTrading();

        if (overtrading.detected) {
            const avgTrades = overtrading.metrics.avg_trades_per_day;
            recommendations.push({
                bias: 'Overtrading',
                recommendation: `Set a daily trade limit of ${Math.max(5, Math.floor(avgTrades * 0.5))} trades per day`,
                priority: overtrading.severity === 'High' ? 'High' : 'Medium'
            });
            recommendations.push({
                bias: 'Overtrading',
                recommendation: 'Implement a mandatory 30-minute cooldown period between trades',
                priority: 'Medium'
            });
        }

        if (lossAversion.detected) {
            const rrRatio = lossAversion.metrics.risk_reward_ratio;
            recommendations.push({
                bias: 'Loss Aversion',
                recommendation: `Set stop-loss orders at 2% and take-profit at ${Math.max(3, Math.floor(rrRatio * 2))}% to improve risk-reward ratio`,
                priority: lossAversion.severity === 'High' ? 'High' : 'Medium'
            });
            recommendations.push({
                bias: 'Loss Aversion',
                recommendation: 'Use trailing stop-losses to let winners run while protecting gains',
                priority: 'Medium'
            });
        }

        if (revengeTrading.detected) {
            recommendations.push({
                bias: 'Revenge Trading',
                recommendation: 'Implement a mandatory 2-hour break after any losing trade',
                priority: revengeTrading.severity === 'High' ? 'High' : 'Medium'
            });
            recommendations.push({
                bias: 'Revenge Trading',
                recommendation: 'Reduce position size by 50% for the next 3 trades after a loss',
                priority: 'Medium'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                bias: 'General',
                recommendation: 'Maintain a trading journal to track emotions and decisions',
                priority: 'Low'
            });
        }

        return recommendations;
    }

    getStatistics() {
        const wins = this.trades.filter(t => t.isWin);
        const losses = this.trades.filter(t => t.isLoss);
        const totalPnL = this.trades.reduce((sum, t) => sum + t.pl, 0);
        const avgPnL = totalPnL / this.trades.length;
        const uniqueAssets = new Set(this.trades.map(t => t.asset)).size;
        const uniqueDates = new Set(this.trades.map(t => t.date)).size;

        return {
            total_trades: this.trades.length,
            winning_trades: wins.length,
            losing_trades: losses.length,
            total_pnl: Math.round(totalPnL * 100) / 100,
            avg_pnl: Math.round(avgPnL * 100) / 100,
            largest_win: Math.round(Math.max(...this.trades.map(t => t.pl)) * 100) / 100,
            largest_loss: Math.round(Math.min(...this.trades.map(t => t.pl)) * 100) / 100,
            win_rate: Math.round((wins.length / this.trades.length) * 1000) / 10,
            trading_days: uniqueDates,
            unique_assets: uniqueAssets
        };
    }

    _emptyResult(biasName) {
        return {
            detected: false,
            severity: 'Low',
            score: 0,
            metrics: {},
            description: `Insufficient data to detect ${biasName.toLowerCase()} patterns.`
        };
    }

    _getOvertradingDescription(severity, avgTrades, rapidPct) {
        if (severity === 'High') {
            return `You're averaging ${avgTrades.toFixed(1)} trades per day with ${rapidPct.toFixed(1)}% occurring within 5 minutes of each other. This suggests impulsive, strategy-less trading that increases transaction costs and emotional stress.`;
        } else if (severity === 'Moderate') {
            return `Your trading frequency (${avgTrades.toFixed(1)} trades/day) is elevated. Consider whether each trade aligns with your strategy before executing.`;
        } else {
            return 'Your trading frequency appears reasonable, but monitor for impulsive trades.';
        }
    }

    _getLossAversionDescription(severity, rrRatio, winRate) {
        if (severity === 'High') {
            return `Your risk-reward ratio (${rrRatio.toFixed(2)}) suggests you're cutting winners short while holding losers. With a ${winRate.toFixed(1)}% win rate, you need larger wins to offset losses.`;
        } else if (severity === 'Moderate') {
            return `Your risk-reward ratio (${rrRatio.toFixed(2)}) could be improved. Consider letting winners run longer and cutting losses faster.`;
        } else {
            return 'Your risk-reward management appears balanced.';
        }
    }

    _getRevengeTradingDescription(severity, rapidPct, winRate) {
        if (severity === 'High') {
            return `You're trading ${rapidPct.toFixed(1)}% of the time within 30 minutes after losses, with only ${winRate.toFixed(1)}% win rate in those trades. This suggests emotional, revenge-driven trading.`;
        } else if (severity === 'Moderate') {
            return `You show some tendency to trade quickly after losses (${rapidPct.toFixed(1)}%). Take breaks after losses to avoid emotional decisions.`;
        } else {
            return 'You're managing emotions well after losses. Continue this discipline.';
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiasDetector;
}
