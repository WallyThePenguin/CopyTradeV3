import os
import sys
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from typing import Dict
from pathlib import Path
import schedule
import time
from utils.logger import logger

# Logger is configured in utils.logger

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
env_path = project_root / '.env'
load_dotenv(env_path)

class ChannelAnalyzer:
    def __init__(self):
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            raise ValueError(f"No database URL found in environment variables. Looking for .env at: {env_path}")

        self.engine = create_engine(self._resolve_connection_url(db_url))
        self.analysis_window = 30  # days
        self.min_trades_for_analysis = 10
        self.risk_levels = {
            'LOW': {'max_trades': 3, 'min_confidence': 0.85},
            'MEDIUM': {'max_trades': 5, 'min_confidence': 0.75},
            'HIGH': {'max_trades': 8, 'min_confidence': 0.65}
        }
        self._channel_cache: Dict[str, pd.DataFrame] = {}

    def _resolve_connection_url(self, db_url: str) -> str:
        """Normalize DATABASE_URL so SQLAlchemy can talk to SQLite or Postgres."""
        normalized = db_url.strip().strip('"').strip("'")
        if normalized.startswith("file:"):
            relative_path = normalized.replace("file:", "", 1)
            db_path = Path(relative_path)
            if not db_path.is_absolute():
                db_path = (project_root / db_path).resolve()
            return f"sqlite:///{db_path.as_posix()}"
        return normalized

    def _window_start(self) -> datetime:
        return datetime.utcnow() - timedelta(days=self.analysis_window)

    def _load_channel_trades(self, channel_id: str) -> pd.DataFrame:
        """Fetch trade + execution stats once per channel and reuse for derived metrics."""
        if channel_id in self._channel_cache:
            return self._channel_cache[channel_id]

        start_time = self._window_start()
        trade_query = text("""
            SELECT
                id AS trade_id,
                "channelId" AS channel_id,
                "entryTime" AS entry_time,
                "exitTime" AS exit_time,
                "optionType" AS option_type,
                status
            FROM "Trade"
            WHERE "channelId" = :channel_id
              AND "entryTime" >= :start_time
        """)

        with self.engine.connect() as conn:
            trades_df = pd.read_sql_query(
                trade_query,
                conn,
                params={'channel_id': channel_id, 'start_time': start_time}
            )

            if trades_df.empty:
                self._channel_cache[channel_id] = trades_df
                return trades_df

            exec_query = text("""
                SELECT
                    "tradeId" AS trade_id,
                    result,
                    pnl,
                    "durationSec" AS duration_sec,
                    "executedAt" AS executed_at
                FROM "ExecutionStats"
                WHERE "tradeId" IN (
                    SELECT id FROM "Trade"
                    WHERE "channelId" = :channel_id
                      AND "entryTime" >= :start_time
                )
            """)
            exec_df = pd.read_sql_query(
                exec_query,
                conn,
                params={'channel_id': channel_id, 'start_time': start_time}
            )

        if not exec_df.empty:
            exec_df = (
                exec_df.sort_values('executed_at')
                .groupby('trade_id', as_index=False)
                .last()
            )

        merged = trades_df.merge(exec_df, on='trade_id', how='left', suffixes=('', '_exec'))
        for col in ('entry_time', 'exit_time', 'executed_at'):
            if col in merged.columns:
                merged[col] = pd.to_datetime(merged[col], errors='coerce')

        self._channel_cache[channel_id] = merged
        return merged

    def get_channel_performance(self, channel_id: str) -> Dict:
        """Calculate comprehensive channel performance metrics."""
        try:
            df = self._load_channel_trades(channel_id)
            if df.empty or len(df) < self.min_trades_for_analysis:
                return None

            total_trades = len(df)

            result_series = df.get('result')
            win_rate = 0.0
            if result_series is not None and not result_series.empty:
                normalized = result_series.fillna('').str.upper()
                valid_results = normalized[normalized != '']
                if not valid_results.empty:
                    win_rate = float((valid_results == 'WIN').sum() / len(valid_results))

            profit_series = pd.to_numeric(df.get('pnl'), errors='coerce').dropna()
            avg_profit = float(profit_series.mean()) if not profit_series.empty else 0.0
            profit_stddev = float(profit_series.std(ddof=1)) if len(profit_series) > 1 else 0.0
            min_profit = float(profit_series.min()) if not profit_series.empty else 0.0
            max_profit = float(profit_series.max()) if not profit_series.empty else 0.0

            duration_series = pd.to_numeric(df.get('duration_sec'), errors='coerce').dropna()
            if duration_series.empty and {'entry_time', 'exit_time'}.issubset(df.columns):
                fallback = (df['exit_time'] - df['entry_time']).dt.total_seconds().dropna()
                duration_series = fallback
            avg_duration = float(duration_series.mean()) if not duration_series.empty else 0.0

            option_series = df.get('option_type')
            options_ratio = 0.0
            if option_series is not None and len(option_series) > 0:
                options_ratio = float(option_series.notna().mean())

            return {
                'total_trades': total_trades,
                'win_rate': win_rate,
                'avg_profit': avg_profit,
                'avg_duration': avg_duration,
                'profit_stddev': profit_stddev,
                'min_profit': min_profit,
                'max_profit': max_profit,
                'options_ratio': options_ratio
            }
        except Exception as e:
            logger.error(f"Error calculating channel performance: {str(e)}")
            return None

    def analyze_trade_patterns(self, channel_id: str) -> Dict:
        """Analyze trading patterns and behaviors."""
        try:
            df = self._load_channel_trades(channel_id)
            if df.empty:
                return None

            time_df = df[df['entry_time'].notna()].copy()
            if time_df.empty:
                return None

            time_df['hour'] = time_df['entry_time'].dt.hour
            time_df['weekday'] = time_df['entry_time'].dt.weekday
            if 'result' in time_df.columns:
                time_df['is_win'] = time_df['result'].fillna('').str.upper() == 'WIN'
            else:
                time_df['is_win'] = False

            hour_group = (
                time_df.groupby('hour')
                .agg(trade_count=('trade_id', 'count'), win_rate=('is_win', 'mean'))
                .reset_index()
            )
            day_group = (
                time_df.groupby('weekday')
                .agg(trade_count=('trade_id', 'count'), win_rate=('is_win', 'mean'))
                .reset_index()
            )

            best_hours = [
                {
                    'hour': int(row.hour),
                    'win_rate': float(row.win_rate if pd.notna(row.win_rate) else 0),
                    'trade_count': int(row.trade_count)
                }
                for row in hour_group.itertuples()
                if row.trade_count >= 3
            ]
            best_days = [
                {
                    'day': int(row.weekday),
                    'win_rate': float(row.win_rate if pd.notna(row.win_rate) else 0),
                    'trade_count': int(row.trade_count)
                }
                for row in day_group.itertuples()
                if row.trade_count >= 3
            ]

            best_hours.sort(key=lambda item: item['trade_count'], reverse=True)
            best_days.sort(key=lambda item: item['trade_count'], reverse=True)

            return {
                'best_hours': best_hours,
                'best_days': best_days,
                'total_trades': int(len(time_df))
            }
        except Exception as e:
            logger.error(f"Error analyzing trade patterns: {str(e)}")
            return None

    def calculate_risk_metrics(self, channel_id: str) -> Dict:
        """Calculate risk-adjusted performance metrics."""
        try:
            df = self._load_channel_trades(channel_id)
            profit_series = pd.to_numeric(df.get('pnl'), errors='coerce').dropna()
            if len(profit_series) < self.min_trades_for_analysis:
                return None

            avg_return = float(profit_series.mean())
            return_stddev = float(profit_series.std(ddof=1)) if len(profit_series) > 1 else 0.0

            cumulative = profit_series.cumsum()
            running_max = cumulative.cummax()
            drawdowns = running_max - cumulative
            max_drawdown = float(drawdowns.max()) if not drawdowns.empty else 0.0

            duration_series = pd.to_numeric(df.get('duration_sec'), errors='coerce').dropna()
            avg_duration = float(duration_series.mean()) if not duration_series.empty else 0.0

            sharpe_ratio = (avg_return - 0.02) / return_stddev if return_stddev else 0.0

            return {
                'sharpe_ratio': sharpe_ratio,
                'max_drawdown': max_drawdown,
                'return_stddev': return_stddev,
                'avg_duration': avg_duration
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
            logger.info(f"Updated channel {channel_id} configuration: {config}")

            # Record performance history so results can be reviewed later
            self._record_performance_history(channel_id, performance)

        except Exception as e:
            logger.error(f"Error updating channel config: {str(e)}")

    def _save_channel_config(self, channel_id: str, config: Dict) -> None:
        """Save channel configuration to database."""
        try:
            query = text("""
                INSERT INTO "ChannelConfig" (
                    "channelId",
                    "isEnabled",
                    "minConfidence",
                    "maxTrades",
                    "riskLevel",
                    "updatedAt"
                )
                VALUES (
                    :channel_id,
                    :is_enabled,
                    :min_confidence,
                    :max_trades,
                    :risk_level,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT("channelId") DO UPDATE SET
                    "isEnabled" = excluded."isEnabled",
                    "minConfidence" = excluded."minConfidence",
                    "maxTrades" = excluded."maxTrades",
                    "riskLevel" = excluded."riskLevel",
                    "updatedAt" = CURRENT_TIMESTAMP
            """)

            params = {
                'channel_id': channel_id,
                'is_enabled': True,
                'min_confidence': config['min_confidence'],
                'max_trades': config['max_trades'],
                'risk_level': config['risk_level']
            }

            with self.engine.begin() as conn:
                conn.execute(query, params)
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
            perf_score = float(performance.get("win_rate", 0) * performance.get("avg_profit", 0))

            with self.engine.begin() as conn:
                conn.execute(
                    query,
                    {
                        "channel_id": channel_id,
                        "period": f"LAST_{self.analysis_window}_DAYS",
                        "start_date": start_date,
                        "end_date": end_date,
                        "total_trades": performance.get("total_trades", 0),
                        "win_rate": performance.get("win_rate", 0),
                        "avg_profit": performance.get("avg_profit", 0),
                        "performance": perf_score,
                    },
                )
        except Exception as e:
            logger.error(f"Error recording performance history: {str(e)}")

    def analyze_all_channels(self) -> None:
        """Analyze all active channels."""
        try:
            self._channel_cache.clear()
            start_time = self._window_start()
            query = text("""
                SELECT DISTINCT "channelId" AS channel_id
                FROM "Trade"
                WHERE "entryTime" >= :start_time
            """)
            
            with self.engine.connect() as conn:
                channels = conn.execute(query, {
                    'start_time': start_time
                }).fetchall()

            for channel in channels:
                channel_id = getattr(channel, 'channel_id', None) or getattr(channel, 'channelId', None) or channel[0]
                logger.info(f"Analyzing channel {channel_id}")
                self.update_channel_config(channel_id)

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
