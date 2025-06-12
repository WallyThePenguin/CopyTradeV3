import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import schedule
import time
import pytz
from utils.logger import logger

# Logger is configured in utils.logger

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / '.env'
load_dotenv(env_path)

class ChannelAnalyzer:
    def __init__(self):
        # Use PostgreSQL connection URL
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            raise ValueError(f"No database URL found in environment variables. Looking for .env at: {env_path}")
            
        self.engine = create_engine(db_url)
        self.analysis_window = 30  # days
        self.min_trades_for_analysis = 10
        self.risk_levels = {
            'LOW': {'max_trades': 3, 'min_confidence': 0.85},
            'MEDIUM': {'max_trades': 5, 'min_confidence': 0.75},
            'HIGH': {'max_trades': 8, 'min_confidence': 0.65}
        }

    def get_channel_performance(self, channel_id: str) -> Dict:
        """Calculate comprehensive channel performance metrics."""
        try:
            query = text("""
                WITH trade_metrics AS (
                    SELECT 
                        t.*,
                        e."executedPrice" as entry_price,
                        e2."executedPrice" as exit_price,
                        e2.pnl,
                        e2."durationSec",
                        e2.result
                    FROM "Trade" t
                    LEFT JOIN "ExecutionStats" e ON t.id = e."tradeId" AND e."executedAt" = t."entryTime"
                    LEFT JOIN "ExecutionStats" e2 ON t.id = e2."tradeId" AND e2."executedAt" = t."exitTime"
                    WHERE t."channelId" = :channel_id
                    AND t."entryTime" >= NOW() - INTERVAL ':window days'
                )
                SELECT 
                    COUNT(*) as total_trades,
                    AVG(CASE WHEN result = 'WIN' THEN 1.0 ELSE 0.0 END) as win_rate,
                    AVG(pnl) as avg_profit,
                    AVG("durationSec") as avg_duration,
                    STDDEV(pnl) as profit_stddev,
                    MIN(pnl) as min_profit,
                    MAX(pnl) as max_profit,
                    AVG(CASE WHEN "optionType" IS NOT NULL THEN 1.0 ELSE 0.0 END) as options_ratio
                FROM trade_metrics
            """)
            
            with self.engine.connect() as conn:
                result = conn.execute(query, {
                    'channel_id': channel_id,
                    'window': self.analysis_window
                }).fetchone()

            if not result or result.total_trades < self.min_trades_for_analysis:
                return None

            return {
                'total_trades': result.total_trades,
                'win_rate': float(result.win_rate),
                'avg_profit': float(result.avg_profit),
                'avg_duration': float(result.avg_duration),
                'profit_stddev': float(result.profit_stddev),
                'min_profit': float(result.min_profit),
                'max_profit': float(result.max_profit),
                'options_ratio': float(result.options_ratio)
            }
        except Exception as e:
            logger.error(f"Error calculating channel performance: {str(e)}")
            return None

    def analyze_trade_patterns(self, channel_id: str) -> Dict:
        """Analyze trading patterns and behaviors."""
        try:
            query = text("""
                WITH trade_times AS (
                    SELECT 
                        EXTRACT(HOUR FROM "entryTime") as hour,
                        EXTRACT(DOW FROM "entryTime") as weekday,
                        "optionType",
                        result
                    FROM "Trade" t
                    JOIN "ExecutionStats" e ON t.id = e."tradeId"
                    WHERE t."channelId" = :channel_id
                    AND t."entryTime" >= NOW() - INTERVAL ':window days'
                )
                SELECT 
                    hour,
                    weekday,
                    COUNT(*) as trade_count,
                    AVG(CASE WHEN result = 'WIN' THEN 1.0 ELSE 0.0 END) as win_rate
                FROM trade_times
                GROUP BY hour, weekday
                ORDER BY trade_count DESC
            """)
            
            with self.engine.connect() as conn:
                results = conn.execute(query, {
                    'channel_id': channel_id,
                    'window': self.analysis_window
                }).fetchall()

            patterns = {
                'best_hours': [],
                'best_days': [],
                'total_trades': len(results)
            }

            for row in results:
                if row.trade_count >= 3:  # Minimum threshold for pattern analysis
                    patterns['best_hours'].append({
                        'hour': int(row.hour),
                        'win_rate': float(row.win_rate),
                        'trade_count': row.trade_count
                    })
                    patterns['best_days'].append({
                        'day': int(row.weekday),
                        'win_rate': float(row.win_rate),
                        'trade_count': row.trade_count
                    })

            return patterns
        except Exception as e:
            logger.error(f"Error analyzing trade patterns: {str(e)}")
            return None

    def calculate_risk_metrics(self, channel_id: str) -> Dict:
        """Calculate risk-adjusted performance metrics."""
        try:
            query = text("""
                WITH trade_returns AS (
                    SELECT 
                        pnl,
                        "durationSec",
                        "optionType"
                    FROM "Trade" t
                    JOIN "ExecutionStats" e ON t.id = e."tradeId"
                    WHERE t."channelId" = :channel_id
                    AND t."entryTime" >= NOW() - INTERVAL ':window days'
                    AND e.result IN ('WIN', 'LOSS')
                )
                SELECT 
                    AVG(pnl) as avg_return,
                    STDDEV(pnl) as return_stddev,
                    MIN(pnl) as max_drawdown,
                    AVG("durationSec") as avg_duration,
                    COUNT(*) as total_trades
                FROM trade_returns
            """)
            
            with self.engine.connect() as conn:
                result = conn.execute(query, {
                    'channel_id': channel_id,
                    'window': self.analysis_window
                }).fetchone()

            if not result or result.total_trades < self.min_trades_for_analysis:
                return None

            # Calculate Sharpe Ratio (assuming risk-free rate of 0.02)
            sharpe_ratio = (float(result.avg_return) - 0.02) / float(result.return_stddev) if float(result.return_stddev) != 0 else 0

            return {
                'sharpe_ratio': sharpe_ratio,
                'max_drawdown': float(result.max_drawdown),
                'return_stddev': float(result.return_stddev),
                'avg_duration': float(result.avg_duration)
            }
        except Exception as e:
            logger.error(f"Error calculating risk metrics: {str(e)}")
            return None

    def update_channel_config(self, channel_id: str) -> None:
        """Update channel configuration based on analysis."""
        try:
            performance = self.get_channel_performance(channel_id)
            if not performance:
                logger.warning(f"Insufficient data for channel {channel_id}")
                return

            risk_metrics = self.calculate_risk_metrics(channel_id)
            if not risk_metrics:
                logger.warning(f"Could not calculate risk metrics for channel {channel_id}")
                return

            # Determine risk level based on metrics
            risk_level = 'MEDIUM'  # Default
            if performance['win_rate'] > 0.8 and risk_metrics['sharpe_ratio'] > 2:
                risk_level = 'HIGH'
            elif performance['win_rate'] < 0.6 or risk_metrics['sharpe_ratio'] < 1:
                risk_level = 'LOW'

            # Update channel configuration
            config = {
                'risk_level': risk_level,
                'max_trades': self.risk_levels[risk_level]['max_trades'],
                'min_confidence': self.risk_levels[risk_level]['min_confidence'],
                'last_updated': datetime.now().isoformat()
            }

            # Save to database or config file
            self._save_channel_config(channel_id, config)
            logger.info(f"Updated channel {channel_id} configuration", config)

            # Record performance history so results can be reviewed later
            self._record_performance_history(channel_id, performance)

        except Exception as e:
            logger.error(f"Error updating channel config: {str(e)}")

    def _save_channel_config(self, channel_id: str, config: Dict) -> None:
        """Save channel configuration to database."""
        try:
            query = text("""
                INSERT INTO "ChannelConfig" ("channelId", config, "updatedAt")
                VALUES (:channel_id, :config, NOW())
                ON CONFLICT ("channelId") 
                DO UPDATE SET 
                    config = :config,
                    "updatedAt" = NOW()
            """)
            
            with self.engine.connect() as conn:
                conn.execute(query, {
                    'channel_id': channel_id,
                    'config': json.dumps(config)
                })
                conn.commit()
        except Exception as e:
            logger.error(f"Error saving channel config: {str(e)}")
            raise

    def _record_performance_history(self, channel_id: str, performance: Dict) -> None:
        """Persist summarized metrics to PerformanceHistory."""
        try:
            query = text(
                """
                INSERT INTO "PerformanceHistory" (
                    "channelId", period, "startDate", "endDate",
                    "totalTrades", "winRate", "avgProfit", performance
                ) VALUES (
                    :channel_id, :period, :start_date, :end_date,
                    :total_trades, :win_rate, :avg_profit, :performance
                )
                """
            )

            start_date = datetime.utcnow() - timedelta(days=self.analysis_window)
            end_date = datetime.utcnow()
            perf_score = performance["win_rate"] * performance["avg_profit"]

            with self.engine.connect() as conn:
                conn.execute(
                    query,
                    {
                        "channel_id": channel_id,
                        "period": f"LAST_{self.analysis_window}_DAYS",
                        "start_date": start_date,
                        "end_date": end_date,
                        "total_trades": performance["total_trades"],
                        "win_rate": performance["win_rate"],
                        "avg_profit": performance["avg_profit"],
                        "performance": perf_score,
                    },
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Error recording performance history: {str(e)}")

    def analyze_all_channels(self) -> None:
        """Analyze all active channels."""
        try:
            query = text("""
                SELECT DISTINCT "channelId"
                FROM "Trade"
                WHERE "entryTime" >= NOW() - INTERVAL ':window days'
            """)
            
            with self.engine.connect() as conn:
                channels = conn.execute(query, {
                    'window': self.analysis_window
                }).fetchall()

            for channel in channels:
                logger.info(f"Analyzing channel {channel.channelId}")
                self.update_channel_config(channel.channelId)

        except Exception as e:
            logger.error(f"Error analyzing all channels: {str(e)}")

def run_analysis():
    """Run the channel analysis."""
    analyzer = ChannelAnalyzer()
    analyzer.analyze_all_channels()

def main():
    """Main entry point for the analysis script."""
    try:
        # Create necessary directories
        os.makedirs('data/logs', exist_ok=True)
        
        # Run initial analysis
        run_analysis()
        
        # Schedule daily analysis
        schedule.every().day.at("00:00").do(run_analysis)
        
        # Keep the script running
        while True:
            schedule.run_pending()
            time.sleep(60)
            
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 