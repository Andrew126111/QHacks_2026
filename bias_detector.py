import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

class BiasDetector:
    def __init__(self, df):
        """
        Initialize the Bias Detector with trading data.
        
        Args:
            df: DataFrame with columns: Timestamp, Buy/sell, Asset, P/L
        """
        self.df = df.copy()
        self.df['Timestamp'] = pd.to_datetime(self.df['Timestamp'])
        self.df['P/L'] = pd.to_numeric(self.df['P/L'], errors='coerce')
        
        # Remove rows with invalid data
        self.df = self.df.dropna(subset=['Timestamp', 'P/L'])
        
        if len(self.df) == 0:
            raise ValueError("No valid trading data found after processing")
        
        self.df = self.df.sort_values('Timestamp')
        self.df['Date'] = self.df['Timestamp'].dt.date
        
        # Calculate additional metrics
        self.df['Is_Loss'] = self.df['P/L'] < 0
        self.df['Is_Win'] = self.df['P/L'] > 0
        
    def detect_overtrading(self):
        """
        Detect overtrading bias:
        - Excessive number of trades per day
        - High frequency trading without clear strategy
        - Trading during non-optimal hours
        """
        trades_per_day = self.df.groupby('Date').size()
        avg_trades_per_day = trades_per_day.mean()
        max_trades_per_day = trades_per_day.max()
        
        # Threshold: more than 10 trades per day on average is concerning
        threshold_avg = 10
        threshold_max = 20
        
        # Calculate trading frequency
        time_diffs = self.df['Timestamp'].diff().dt.total_seconds() / 60  # minutes
        avg_time_between_trades = time_diffs[time_diffs > 0].mean()
        
        # Detect rapid-fire trading (trades within 5 minutes)
        rapid_trades = (time_diffs < 5).sum()
        rapid_trade_pct = (rapid_trades / len(self.df)) * 100
        
        # Calculate win rate
        win_rate = (self.df['Is_Win'].sum() / len(self.df)) * 100
        
        # Score: 0-100, higher = more severe
        score = 0
        if avg_trades_per_day > threshold_avg:
            score += min(40, (avg_trades_per_day / threshold_avg) * 20)
        if max_trades_per_day > threshold_max:
            score += min(30, (max_trades_per_day / threshold_max) * 15)
        if rapid_trade_pct > 30:
            score += min(30, (rapid_trade_pct / 30) * 15)
        
        severity = 'Low' if score < 30 else 'Moderate' if score < 60 else 'High'
        
        return {
            'detected': score > 25,
            'severity': severity,
            'score': min(100, round(score, 1)),
            'metrics': {
                'avg_trades_per_day': round(avg_trades_per_day, 2),
                'max_trades_per_day': int(max_trades_per_day),
                'rapid_trade_percentage': round(rapid_trade_pct, 1),
                'avg_minutes_between_trades': round(avg_time_between_trades, 1) if not pd.isna(avg_time_between_trades) else 0,
                'win_rate': round(win_rate, 1)
            },
            'description': self._get_overtrading_description(severity, avg_trades_per_day, rapid_trade_pct)
        }
    
    def detect_loss_aversion(self):
        """
        Detect loss aversion bias:
        - Holding losing positions too long
        - Cutting winning positions too early
        - Asymmetric risk/reward behavior
        """
        wins = self.df[self.df['Is_Win']]
        losses = self.df[self.df['Is_Loss']]
        
        if len(wins) == 0 or len(losses) == 0:
            return {
                'detected': False,
                'severity': 'Low',
                'score': 0,
                'metrics': {},
                'description': 'Insufficient data to detect loss aversion patterns.'
            }
        
        avg_win = wins['P/L'].mean()
        avg_loss = abs(losses['P/L'].mean())
        
        # Risk-reward ratio (should be > 1.5 for healthy trading)
        risk_reward_ratio = avg_win / avg_loss if avg_loss > 0 else 0
        
        # Win rate
        win_rate = (len(wins) / len(self.df)) * 100
        
        # Largest win vs largest loss
        largest_win = wins['P/L'].max()
        largest_loss = abs(losses['P/L'].min())
        
        # Calculate holding patterns (if we had entry/exit times)
        # For now, use P/L distribution
        win_distribution = wins['P/L'].describe()
        loss_distribution = losses['P/L'].describe()
        
        # Score loss aversion
        score = 0
        
        # Poor risk-reward ratio indicates cutting wins early
        if risk_reward_ratio < 1.0:
            score += 40
        elif risk_reward_ratio < 1.5:
            score += 20
        
        # High win rate but low average win suggests cutting winners early
        if win_rate > 60 and risk_reward_ratio < 1.2:
            score += 30
        
        # Large losses relative to wins suggests holding losers
        if largest_loss > largest_win * 2:
            score += 30
        
        severity = 'Low' if score < 30 else 'Moderate' if score < 60 else 'High'
        
        return {
            'detected': score > 25,
            'severity': severity,
            'score': min(100, round(score, 1)),
            'metrics': {
                'risk_reward_ratio': round(risk_reward_ratio, 2),
                'avg_win': round(avg_win, 2),
                'avg_loss': round(abs(avg_loss), 2),
                'win_rate': round(win_rate, 1),
                'largest_win': round(largest_win, 2),
                'largest_loss': round(largest_loss, 2)
            },
            'description': self._get_loss_aversion_description(severity, risk_reward_ratio, win_rate)
        }
    
    def detect_revenge_trading(self):
        """
        Detect revenge trading bias:
        - Trading immediately after losses
        - Increasing position size after losses
        - Emotional trading patterns
        - Trading outside normal patterns after losses
        """
        if len(self.df) < 2:
            return {
                'detected': False,
                'severity': 'Low',
                'score': 0,
                'metrics': {},
                'description': 'Insufficient data to detect revenge trading patterns.'
            }
        
        # Calculate time between trades
        self.df['Time_Since_Prev'] = self.df['Timestamp'].diff().dt.total_seconds() / 60  # minutes
        self.df['Prev_Is_Loss'] = self.df['Is_Loss'].shift(1)
        
        # Trades immediately after losses
        after_loss = self.df[self.df['Prev_Is_Loss'] == True]
        after_win = self.df[self.df['Prev_Is_Loss'] == False]
        
        if len(after_loss) == 0:
            return {
                'detected': False,
                'severity': 'Low',
                'score': 0,
                'metrics': {},
                'description': 'No consecutive loss patterns detected.'
            }
        
        # Average time between trades after losses vs after wins
        avg_time_after_loss = after_loss['Time_Since_Prev'].mean()
        avg_time_after_win = after_win['Time_Since_Prev'].mean() if len(after_win) > 0 else avg_time_after_loss
        
        # Rapid trading after losses (within 30 minutes)
        rapid_after_loss = (after_loss['Time_Since_Prev'] < 30).sum()
        rapid_after_loss_pct = (rapid_after_loss / len(after_loss)) * 100 if len(after_loss) > 0 else 0
        
        # Check if position sizes increase after losses (using P/L as proxy)
        # Larger absolute P/L after losses might indicate larger positions
        avg_abs_pl_after_loss = abs(after_loss['P/L']).mean()
        avg_abs_pl_after_win = abs(after_win['P/L']).mean() if len(after_win) > 0 else avg_abs_pl_after_loss
        
        # Win rate after losses
        win_rate_after_loss = (after_loss['Is_Win'].sum() / len(after_loss)) * 100 if len(after_loss) > 0 else 0
        
        # Score revenge trading
        score = 0
        
        # Trading much faster after losses
        if avg_time_after_loss < avg_time_after_win * 0.5:
            score += 40
        
        # High percentage of rapid trades after losses
        if rapid_after_loss_pct > 50:
            score += 30
        
        # Larger positions after losses (if P/L magnitude increases)
        if avg_abs_pl_after_loss > avg_abs_pl_after_win * 1.3:
            score += 20
        
        # Poor win rate after losses suggests emotional trading
        if win_rate_after_loss < 40:
            score += 20
        
        severity = 'Low' if score < 30 else 'Moderate' if score < 60 else 'High'
        
        return {
            'detected': score > 25,
            'severity': severity,
            'score': min(100, round(score, 1)),
            'metrics': {
                'avg_minutes_after_loss': round(avg_time_after_loss, 1) if not pd.isna(avg_time_after_loss) else 0,
                'avg_minutes_after_win': round(avg_time_after_win, 1) if not pd.isna(avg_time_after_win) else 0,
                'rapid_trade_after_loss_pct': round(rapid_after_loss_pct, 1),
                'win_rate_after_loss': round(win_rate_after_loss, 1),
                'avg_abs_pl_after_loss': round(avg_abs_pl_after_loss, 2),
                'avg_abs_pl_after_win': round(avg_abs_pl_after_win, 2)
            },
            'description': self._get_revenge_trading_description(severity, rapid_after_loss_pct, win_rate_after_loss)
        }
    
    def generate_summary(self):
        """Generate overall summary of detected biases"""
        total_trades = len(self.df)
        total_pl = self.df['P/L'].sum()
        win_rate = (self.df['Is_Win'].sum() / total_trades) * 100
        
        biases_detected = []
        if self.detect_overtrading()['detected']:
            biases_detected.append('Overtrading')
        if self.detect_loss_aversion()['detected']:
            biases_detected.append('Loss Aversion')
        if self.detect_revenge_trading()['detected']:
            biases_detected.append('Revenge Trading')
        
        return {
            'total_trades': total_trades,
            'total_pnl': round(total_pl, 2),
            'win_rate': round(win_rate, 1),
            'biases_detected': biases_detected,
            'bias_count': len(biases_detected)
        }
    
    def generate_recommendations(self):
        """Generate personalized recommendations based on detected biases"""
        recommendations = []
        
        overtrading = self.detect_overtrading()
        loss_aversion = self.detect_loss_aversion()
        revenge_trading = self.detect_revenge_trading()
        
        if overtrading['detected']:
            avg_trades = overtrading['metrics']['avg_trades_per_day']
            recommendations.append({
                'bias': 'Overtrading',
                'recommendation': f'Set a daily trade limit of {max(5, int(avg_trades * 0.5))} trades per day',
                'priority': 'High' if overtrading['severity'] == 'High' else 'Medium'
            })
            recommendations.append({
                'bias': 'Overtrading',
                'recommendation': 'Implement a mandatory 30-minute cooldown period between trades',
                'priority': 'Medium'
            })
        
        if loss_aversion['detected']:
            rr_ratio = loss_aversion['metrics']['risk_reward_ratio']
            recommendations.append({
                'bias': 'Loss Aversion',
                'recommendation': f'Set stop-loss orders at 2% and take-profit at {max(3, int(rr_ratio * 2))}% to improve risk-reward ratio',
                'priority': 'High' if loss_aversion['severity'] == 'High' else 'Medium'
            })
            recommendations.append({
                'bias': 'Loss Aversion',
                'recommendation': 'Use trailing stop-losses to let winners run while protecting gains',
                'priority': 'Medium'
            })
        
        if revenge_trading['detected']:
            recommendations.append({
                'bias': 'Revenge Trading',
                'recommendation': 'Implement a mandatory 2-hour break after any losing trade',
                'priority': 'High' if revenge_trading['severity'] == 'High' else 'Medium'
            })
            recommendations.append({
                'bias': 'Revenge Trading',
                'recommendation': 'Reduce position size by 50% for the next 3 trades after a loss',
                'priority': 'Medium'
            })
        
        # General recommendations
        if not recommendations:
            recommendations.append({
                'bias': 'General',
                'recommendation': 'Maintain a trading journal to track emotions and decisions',
                'priority': 'Low'
            })
            recommendations.append({
                'bias': 'General',
                'recommendation': 'Review your trading plan weekly and stick to predefined rules',
                'priority': 'Low'
            })
        
        return recommendations
    
    def get_statistics(self):
        """Get comprehensive trading statistics"""
        return {
            'total_trades': len(self.df),
            'winning_trades': int(self.df['Is_Win'].sum()),
            'losing_trades': int(self.df['Is_Loss'].sum()),
            'total_pnl': round(self.df['P/L'].sum(), 2),
            'avg_pnl': round(self.df['P/L'].mean(), 2),
            'largest_win': round(self.df['P/L'].max(), 2),
            'largest_loss': round(self.df['P/L'].min(), 2),
            'win_rate': round((self.df['Is_Win'].sum() / len(self.df)) * 100, 1),
            'trading_days': len(self.df['Date'].unique()),
            'unique_assets': self.df['Asset'].nunique()
        }
    
    def _get_overtrading_description(self, severity, avg_trades, rapid_pct):
        if severity == 'High':
            return f"You're averaging {avg_trades:.1f} trades per day with {rapid_pct:.1f}% occurring within 5 minutes of each other. This suggests impulsive, strategy-less trading that increases transaction costs and emotional stress."
        elif severity == 'Moderate':
            return f"Your trading frequency ({avg_trades:.1f} trades/day) is elevated. Consider whether each trade aligns with your strategy before executing."
        else:
            return "Your trading frequency appears reasonable, but monitor for impulsive trades."
    
    def _get_loss_aversion_description(self, severity, rr_ratio, win_rate):
        if severity == 'High':
            return f"Your risk-reward ratio ({rr_ratio:.2f}) suggests you're cutting winners short while holding losers. With a {win_rate:.1f}% win rate, you need larger wins to offset losses."
        elif severity == 'Moderate':
            return f"Your risk-reward ratio ({rr_ratio:.2f}) could be improved. Consider letting winners run longer and cutting losses faster."
        else:
            return "Your risk-reward management appears balanced."
    
    def _get_revenge_trading_description(self, severity, rapid_pct, win_rate):
        if severity == 'High':
            return f"You're trading {rapid_pct:.1f}% of the time within 30 minutes after losses, with only {win_rate:.1f}% win rate in those trades. This suggests emotional, revenge-driven trading."
        elif severity == 'Moderate':
            return f"You show some tendency to trade quickly after losses ({rapid_pct:.1f}%). Take breaks after losses to avoid emotional decisions."
        else:
            return "You're managing emotions well after losses. Continue this discipline."
