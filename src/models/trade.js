/**
 * Trade data model for tracking active and historical trades
 */
class Trade {
    constructor(data) {
        this.symbol = data.symbol?.toUpperCase();
        this.action = data.action?.toUpperCase();
        this.optionType = data.optionType?.toUpperCase();
        this.strikePrice = data.strikePrice ? Number(data.strikePrice) : null;
        this.entryPrice = data.entryPrice ? Number(data.entryPrice) : null;
        this.confidence = data.confidence ? Math.min(Math.max(Number(data.confidence), 0), 1) : 0;
        this.signalType = data.signalType?.toUpperCase();
        this.entryTime = data.entryTime || Date.now();
        this.status = data.status || 'ACTIVE';
        this.exitReason = data.exitReason || null;
        this.exitTime = data.exitTime || null;
    }

    get key() {
        return `${this.symbol}_${this.strikePrice}`;
    }

    toJSON() {
        return {
            symbol: this.symbol,
            action: this.action,
            optionType: this.optionType,
            strikePrice: this.strikePrice,
            entryPrice: this.entryPrice,
            confidence: this.confidence,
            signalType: this.signalType,
            entryTime: this.entryTime,
            status: this.status,
            exitReason: this.exitReason,
            exitTime: this.exitTime
        };
    }

    static fromJSON(data) {
        return new Trade(data);
    }
}

export default Trade; 