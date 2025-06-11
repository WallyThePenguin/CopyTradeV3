/**
 * Signal data model for trade signals from Mistral analysis
 */
class Signal {
    constructor(data) {
        this.isTradeSignal = Boolean(data.isTradeSignal);
        this.symbol = data.symbol?.toUpperCase() || null;
        this.action = data.action?.toUpperCase() || null;
        this.optionType = data.optionType?.toUpperCase() || null;
        this.strikePrice = data.strikePrice ? Number(data.strikePrice) : null;
        this.entryPrice = data.entryPrice ? Number(data.entryPrice) : null;
        this.confidence = data.confidence ? Math.min(Math.max(Number(data.confidence), 0), 1) : 0;
        this.signalType = data.signalType?.toUpperCase() || null;
    }

    isValid() {
        return this.isTradeSignal &&
            this.symbol &&
            this.action &&
            this.confidence > 0;
    }

    toJSON() {
        return {
            isTradeSignal: this.isTradeSignal,
            symbol: this.symbol,
            action: this.action,
            optionType: this.optionType,
            strikePrice: this.strikePrice,
            entryPrice: this.entryPrice,
            confidence: this.confidence,
            signalType: this.signalType
        };
    }

    static fromJSON(data) {
        return new Signal(data);
    }
}

export default Signal; 