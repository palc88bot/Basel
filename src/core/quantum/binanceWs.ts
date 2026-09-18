import WebSocket from 'ws';

export interface Kline {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
    quoteVolume: number;
    trades: number;
}

export interface OrderBookLevel {
    price: number;
    quantity: number;
}

export interface OrderBookSnapshot {
    timestamp: number;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

export interface Trade {
    price: number;
    quantity: number;
    timestamp: number;
    isBuyerMaker: boolean;
}

type KlineCallback = (kline: Kline) => void;
type OrderBookCallback = (book: OrderBookSnapshot) => void;
type TradeCallback = (trade: Trade) => void;

/**
 * Binance Futures WebSocket Client with Auto-Reconnect, Ping/Pong Heartbeat, and Resilient Stream Recovery
 */
export class BinanceWebSocket {
    private ws: WebSocket | null = null;
    private symbol: string;
    private klineInterval: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private isConnected = false;
    private pingIntervalTimer: NodeJS.Timeout | null = null;
    private isTerminated = false;
    
    private klineCallbacks: KlineCallback[] = [];
    private orderBookCallbacks: OrderBookCallback[] = [];
    private tradeCallbacks: TradeCallback[] = [];

    constructor(symbol: string = 'BTCUSDT', interval: string = '1m') {
        this.symbol = symbol.toLowerCase();
        this.klineInterval = interval;
    }

    /**
     * Connect to Binance Futures Stream with Ping/Pong heartbeat
     */
    connect(): Promise<void> {
        this.isTerminated = false;
        return new Promise((resolve, reject) => {
            const streams = [
                `${this.symbol}@kline_${this.klineInterval}`,
                `${this.symbol}@depth10@100ms`,
                `${this.symbol}@trade`
            ];

            const url = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;
            
            try {
                this.ws = new WebSocket(url);

                this.ws.on('open', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    } catch (err) {
                        // ignore malformed frame
                    }
                });

                this.ws.on('ping', () => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.pong();
                    }
                });

                this.ws.on('error', (err) => {
                    if (!this.isConnected) {
                        reject(err);
                    }
                });

                this.ws.on('close', () => {
                    this.isConnected = false;
                    this.stopHeartbeat();
                    if (!this.isTerminated) {
                        this.reconnect();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Binance Ping/Pong Heartbeat (every 2 minutes)
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.pingIntervalTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.ping();
                } catch {
                    // socket closed
                }
            }
        }, 120000); // 2 minutes
    }

    private stopHeartbeat(): void {
        if (this.pingIntervalTimer) {
            clearInterval(this.pingIntervalTimer);
            this.pingIntervalTimer = null;
        }
    }

    /**
     * Handle Binance Stream Payloads
     */
    private handleMessage(message: any): void {
        if (!message || !message.stream || !message.data) return;
        const stream: string = message.stream;
        const data = message.data;

        if (stream.includes('@kline_')) {
            const k = data.k;
            if (k) {
                const kline: Kline = {
                    timestamp: k.t,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v),
                    closeTime: k.T,
                    quoteVolume: parseFloat(k.q),
                    trades: k.n
                };
                this.klineCallbacks.forEach(cb => cb(kline));
            }
        } else if (stream.includes('@depth')) {
            if (data.bids && data.asks) {
                const book: OrderBookSnapshot = {
                    timestamp: Date.now(),
                    bids: data.bids.map((b: string[]) => ({
                        price: parseFloat(b[0]),
                        quantity: parseFloat(b[1])
                    })),
                    asks: data.asks.map((a: string[]) => ({
                        price: parseFloat(a[0]),
                        quantity: parseFloat(a[1])
                    }))
                };
                this.orderBookCallbacks.forEach(cb => cb(book));
            }
        } else if (stream.includes('@trade')) {
            const trade: Trade = {
                price: parseFloat(data.p),
                quantity: parseFloat(data.q),
                timestamp: data.T,
                isBuyerMaker: data.m
            };
            this.tradeCallbacks.forEach(cb => cb(trade));
        }
    }

    /**
     * Exponential Backoff Reconnection
     */
    private reconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(1.8, this.reconnectAttempts), 30000);
            setTimeout(() => {
                if (!this.isTerminated) {
                    this.connect().catch(() => {});
                }
            }, delay);
        }
    }

    onKline(cb: KlineCallback): void { this.klineCallbacks.push(cb); }
    onOrderBook(cb: OrderBookCallback): void { this.orderBookCallbacks.push(cb); }
    onTrade(cb: TradeCallback): void { this.tradeCallbacks.push(cb); }

    disconnect(): void {
        this.isTerminated = true;
        this.stopHeartbeat();
        if (this.ws) {
            try {
                this.ws.close();
            } catch {
                // ignore
            }
            this.ws = null;
        }
    }
}

/**
 * Resilient In-Memory Ring Buffer for Market Data
 */
export class DataBuffer {
    private klines: Kline[] = [];
    private orderBook: OrderBookSnapshot | null = null;
    private recentTrades: Trade[] = [];
    private maxKlines: number;
    private maxTrades: number;

    constructor(maxKlines: number = 500, maxTrades: number = 1000) {
        this.maxKlines = maxKlines;
        this.maxTrades = maxTrades;
    }

    addKline(kline: Kline): void {
        if (this.klines.length > 0 && 
            this.klines[this.klines.length - 1].timestamp === kline.timestamp) {
            this.klines[this.klines.length - 1] = kline;
        } else {
            this.klines.push(kline);
            if (this.klines.length > this.maxKlines) {
                this.klines.shift();
            }
        }
    }

    updateOrderBook(book: OrderBookSnapshot): void {
        this.orderBook = book;
    }

    addTrade(trade: Trade): void {
        this.recentTrades.push(trade);
        if (this.recentTrades.length > this.maxTrades) {
            this.recentTrades.shift();
        }
    }

    getKlines(): Kline[] { return this.klines; }
    getOrderBook(): OrderBookSnapshot | null { return this.orderBook; }
    getRecentTrades(): Trade[] { return this.recentTrades; }

    isReady(): boolean {
        return this.klines.length >= 20 && this.orderBook !== null;
    }
}
