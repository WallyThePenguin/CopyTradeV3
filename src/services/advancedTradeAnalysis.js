import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Advanced Trade Analysis Service
 * Implements enhanced trade detection and analysis features
 */
class AdvancedTradeAnalysis {
  constructor() {
    this.prisma = prisma;
    this.sentimentKeywords = {
      bullish: [
        "moon",
        "rocket",
        "lets go",
        "letsgoo",
        "lfg",
        "bullish",
        "calls",
        "buy",
        "long",
        "pump",
        "🚀",
        "🌙",
        "📈",
        "💎",
        "🙌",
      ],
      bearish: ["puts", "short", "bearish", "dump", "crash", "red", "sell", "drop", "📉", "🐻", "💩", "🩸"],
      highConfidence: ["all in", "yolo", "loading", "huge", "massive", "guaranteed", "free money"],
      lowConfidence: ["maybe", "might", "possibly", "thinking", "considering", "watching"],
    };
  }

  /**
   * Detect multi-leg trades
   * @param {string} message - The message to analyze
   * @returns {Object} Multi-leg trade details if detected
   */
  detectMultiLegTrade(message) {
    const multiLegPatterns = [
      // Pattern: "SPY 580C then 582C"
      /(\w+)\s+(\d+)([CP])\s+then\s+(\d+)([CP])/i,
      // Pattern: "SPY 580/582 call spread"
      /(\w+)\s+(\d+)\/(\d+)\s+(call|put)\s+spread/i,
      // Pattern: "SPY 580C and 582C"
      /(\w+)\s+(\d+)([CP])\s+and\s+(\d+)([CP])/i,
      // Pattern: "Rolled SPY 580C to 582C"
      /rolled?\s+(\w+)\s+(\d+)([CP])\s+to\s+(\d+)([CP])/i,
    ];

    for (const pattern of multiLegPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          isMultiLeg: true,
          type: this.determineMultiLegType(match, pattern),
          legs: this.extractLegs(match, pattern),
          symbol: match[1].toUpperCase(),
        };
      }
    }

    return { isMultiLeg: false };
  }

  /**
   * Determine multi-leg trade type
   */
  determineMultiLegType(match, pattern) {
    if (pattern.source.includes("spread")) return "SPREAD";
    if (pattern.source.includes("rolled")) return "ROLL";
    if (pattern.source.includes("then")) return "SEQUENCE";
    return "MULTI";
  }

  /**
   * Extract individual legs from multi-leg trade
   */
  extractLegs(match, pattern) {
    const legs = [];

    if (pattern.source.includes("spread")) {
      legs.push({
        strike: parseFloat(match[2]),
        type: match[4].toUpperCase().startsWith("C") ? "CALL" : "PUT",
        action: "BUY",
      });
      legs.push({
        strike: parseFloat(match[3]),
        type: match[4].toUpperCase().startsWith("C") ? "CALL" : "PUT",
        action: "SELL",
      });
    } else {
      // Extract based on specific pattern
      // This is simplified - would need more logic for all patterns
      legs.push({
        strike: parseFloat(match[2]),
        type: match[3] === "C" ? "CALL" : "PUT",
        action: "BUY",
      });
      if (match[4]) {
        legs.push({
          strike: parseFloat(match[4]),
          type: match[5] === "C" ? "CALL" : "PUT",
          action: pattern.source.includes("rolled") ? "BUY" : "SELL",
        });
      }
    }

    return legs;
  }

  /**
   * Analyze sentiment of the message
   * @param {string} message - The message to analyze
   * @returns {Object} Sentiment analysis results
   */
  analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();
    const analysis = {
      sentiment: "NEUTRAL",
      score: 0,
      indicators: [],
    };

    // Count bullish indicators
    let bullishScore = 0;
    this.sentimentKeywords.bullish.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        bullishScore++;
        analysis.indicators.push(`bullish:${keyword}`);
      }
    });

    // Count bearish indicators
    let bearishScore = 0;
    this.sentimentKeywords.bearish.forEach((keyword) => {
      if (lowerMessage.includes(keyword)) {
        bearishScore++;
        analysis.indicators.push(`bearish:${keyword}`);
      }
    });

    // Calculate overall sentiment
    analysis.score = bullishScore - bearishScore;
    if (analysis.score > 1) {
      analysis.sentiment = "BULLISH";
    } else if (analysis.score < -1) {
      analysis.sentiment = "BEARISH";
    }

    // Check confidence modifiers
    const hasHighConfidence = this.sentimentKeywords.highConfidence.some((keyword) => lowerMessage.includes(keyword));
    const hasLowConfidence = this.sentimentKeywords.lowConfidence.some((keyword) => lowerMessage.includes(keyword));

    analysis.confidenceModifier = hasHighConfidence ? 1.2 : hasLowConfidence ? 0.8 : 1.0;

    return analysis;
  }

  /**
   * Detect sarcasm or intent reversal
   * @param {string} message - The message to analyze
   * @returns {boolean} True if sarcasm/reversal detected
   */
  detectSarcasm(message) {
    const sarcasmPatterns = [
      /should[''`]?ve/i,
      /could[''`]?ve/i,
      /would[''`]?ve/i,
      /wish i/i,
      /if only/i,
      /too late/i,
      /missed it/i,
      /\s\/s\s/, // explicit sarcasm marker
      /just kidding/i,
      /jk\s/i,
    ];

    return sarcasmPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract emotional intensity
   * @param {string} message - The message to analyze
   * @returns {number} Intensity score (0-1)
   */
  extractEmotionalIntensity(message) {
    let intensity = 0.5; // baseline

    // All caps increases intensity
    const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (capsRatio > 0.6) intensity += 0.2;

    // Multiple exclamation marks
    const exclamationCount = (message.match(/!/g) || []).length;
    if (exclamationCount > 2) intensity += 0.1;

    // Repeated characters (e.g., "YESSSSS")
    if (/(.)\1{3,}/i.test(message)) intensity += 0.1;

    // Emoji intensity
    const emojiCount = (message.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 3) intensity += 0.1;

    return Math.min(intensity, 1.0);
  }

  /**
   * Track trade duration and patterns
   * @param {string} channelId - Channel ID
   * @param {string} traderId - Trader ID
   */
  async analyzeTraderPatterns(channelId, traderId) {
    const trades = await this.prisma.trade.findMany({
      where: {
        channelId,
        traderId,
        status: "CLOSED",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (trades.length === 0) return null;

    // Calculate average hold time
    const holdTimes = trades
      .filter((t) => t.exitTime && t.entryTime)
      .map((t) => (t.exitTime - t.entryTime) / (1000 * 60)); // in minutes

    const avgHoldTime = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;

    // Determine trader style
    let traderStyle = "UNKNOWN";
    if (avgHoldTime < 30) traderStyle = "SCALPER";
    else if (avgHoldTime < 240) traderStyle = "DAY_TRADER";
    else if (avgHoldTime < 1440) traderStyle = "SWING_TRADER";
    else traderStyle = "POSITION_TRADER";

    // Analyze trading hours
    const tradingHours = {};
    trades.forEach((trade) => {
      const hour = new Date(trade.entryTime).getHours();
      tradingHours[hour] = (tradingHours[hour] || 0) + 1;
    });

    // Find most active hour
    const mostActiveHour = Object.entries(tradingHours).sort(([, a], [, b]) => b - a)[0]?.[0];

    // Calculate win streaks
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    trades.forEach((trade) => {
      if (trade.profitLoss > 0) {
        currentStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentLossStreak++;
        currentStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });

    return {
      traderStyle,
      avgHoldTime,
      mostActiveHour,
      maxWinStreak,
      maxLossStreak,
      tradingHours,
      totalTrades: trades.length,
    };
  }

  /**
   * Risk assessment based on message content
   * @param {string} message - The message to analyze
   * @param {Object} sentiment - Sentiment analysis results
   * @returns {Object} Risk assessment
   */
  assessRisk(message, sentiment) {
    const riskFactors = {
      high: ["yolo", "all in", "max", "everything", "mortgage", "loan"],
      medium: ["position", "adding", "scaling"],
      low: ["small", "starter", "testing", "paper"],
    };

    let riskLevel = "MEDIUM";
    let riskScore = 0.5;

    const lowerMessage = message.toLowerCase();

    // Check for high risk indicators
    if (riskFactors.high.some((factor) => lowerMessage.includes(factor))) {
      riskLevel = "HIGH";
      riskScore = 0.8;
    } else if (riskFactors.low.some((factor) => lowerMessage.includes(factor))) {
      riskLevel = "LOW";
      riskScore = 0.3;
    }

    // Adjust based on emotional intensity
    const emotionalIntensity = this.extractEmotionalIntensity(message);
    if (emotionalIntensity > 0.7) {
      riskScore = Math.min(riskScore * 1.2, 1.0);
    }

    // Adjust based on sentiment confidence
    riskScore *= sentiment.confidenceModifier || 1.0;

    return {
      level: riskLevel,
      score: riskScore,
      factors: {
        emotionalIntensity,
        sentimentConfidence: sentiment.confidenceModifier || 1.0,
        explicitRiskKeywords: riskLevel !== "MEDIUM",
      },
    };
  }
}

// Export singleton instance
export const advancedAnalysis = new AdvancedTradeAnalysis();
