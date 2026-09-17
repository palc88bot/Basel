/**
 * OMEGA Bot - User Data Stream Listener
 * ======================================
 * مستمع تيار بيانات المستخدم (User Data Stream)
 * 
 * الوظيفة:
 *   الاستماع الفوري لأحداث الحساب (تنفيذ الأوامر، الإلغاء، تغير الرصيد) 
 *   عبر WebSocket مخصص من Binance/Bybit.
 */

import { WebSocket } from 'ws';
import { createHmac } from 'crypto';
import { StateDatabase } from '../quant/stateDatabase';
import { HybridExitSystem } from './hybridExit';
import { serverVault } from './secretVault';

export class UserDataStreamListener {
  private exchangeType: 'BINANCE' | 'BYBIT';
  private stateDb: StateDatabase;
  private hybridExit: HybridExitSystem;
  private testnet: boolean;
  
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(
    exchangeType: 'BINANCE' | 'BYBIT',
    stateDb: StateDatabase,
    hybridExit: HybridExitSystem,
    testnet: boolean = true
  ) {
    this.exchangeType = exchangeType;
    this.stateDb = stateDb;
    this.hybridExit = hybridExit;
    this.testnet = testnet;
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log(`[UserDataStream] 🚀 Starting listener for ${this.exchangeType}...`);
    await this.connect();
  }

  public stop(): void {
    this.running = false;
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log(`[UserDataStream] 🛑 Stopped listener for ${this.exchangeType}`);
  }

  private async connect(): Promise<void> {
    try {
      const apiKey = this.exchangeType === 'BINANCE' 
        ? serverVault.getSecret('BINANCE_API_KEY') 
        : serverVault.getSecret('BYBIT_API_KEY');
      
      if (!apiKey) {
        console.log(`[UserDataStream] ⏳ Awaiting API Keys for ${this.exchangeType}. Listener will start automatically once keys are provided.`);
        this.scheduleReconnect();
        return;
      }

      if (this.exchangeType === 'BINANCE') {
        await this.connectBinance();
      } else {
        await this.connectBybit();
      }
    } catch (err: any) {
      console.error(`[UserDataStream] ❌ Connection failed: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  // ==================== BINANCE LOGIC ====================

  private async connectBinance(): Promise<void> {
    const apiKey = serverVault.getSecret('BINANCE_API_KEY');
    if (!apiKey) return; // Should be handled by connect()

    const baseUrl = this.testnet 
      ? 'https://testnet.binancefuture.com' 
      : 'https://fapi.binance.com';
    
    const wsBaseUrl = this.testnet
      ? 'wss://stream.binancefuture.com/ws'
      : 'wss://fstream.binance.com/ws';

    // 1. Get Listen Key
    const response = await fetch(`${baseUrl}/fapi/v1/listenKey`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    });
    const data: any = await response.json();
    if (!data.listenKey) throw new Error('Failed to get Binance Listen Key');

    this.listenKey = data.listenKey;
    
    // 2. Setup Keep-alive
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(async () => {
      try {
        await fetch(`${baseUrl}/fapi/v1/listenKey`, {
          method: 'PUT',
          headers: { 'X-MBX-APIKEY': apiKey }
        });
      } catch (e) {
        console.warn('[UserDataStream] Binance ListenKey keep-alive failed');
      }
    }, 30 * 60 * 1000); // 30 mins

    // 3. Connect WebSocket
    this.ws = new WebSocket(`${wsBaseUrl}/${this.listenKey}`);

    this.ws.on('open', () => {
      console.log(`[UserDataStream] ✅ Connected to Binance WebSocket`);
    });

    this.ws.on('message', (msg) => {
      this.handleBinanceMessage(JSON.parse(msg.toString()));
    });

    this.ws.on('close', () => {
      console.warn('[UserDataStream] ⚠️ Binance connection closed');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[UserDataStream] ❌ Binance WebSocket error:', err.message);
    });
  }

  private handleBinanceMessage(data: any): void {
    if (data.e === 'ORDER_TRADE_UPDATE') {
      const order = data.o;
      const symbol = order.s;
      const orderId = order.i.toString();
      const status = order.X; // FILLED, CANCELED, etc.
      const lastFilledQty = parseFloat(order.l);
      const lastPrice = parseFloat(order.L);

      if (status === 'FILLED') {
        console.log(`[UserDataStream] 🎯 Order FILLED on Binance: ${symbol} (${orderId})`);
        this.hybridExit.handleOrderFill(symbol, orderId).catch(err => {
          console.error(`[UserDataStream] Error in fill handler:`, err.message);
        });
      }
    }
  }

  // ==================== BYBIT LOGIC ====================

  private async connectBybit(): Promise<void> {
    // Bybit V5 Private Stream logic
    const apiKey = serverVault.getSecret('BYBIT_API_KEY');
    const apiSecret = serverVault.getSecret('BYBIT_API_SECRET');
    if (!apiKey || !apiSecret) return; // Should be handled by connect()

    const wsUrl = this.testnet
      ? 'wss://stream-testnet.bybit.com/v5/private'
      : 'wss://stream.bybit.com/v5/private';

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(`[UserDataStream] ✅ Connected to Bybit WebSocket`);
      this.authBybit(apiKey, apiSecret);
    });

    this.ws.on('message', (msg) => {
      this.handleBybitMessage(JSON.parse(msg.toString()));
    });

    this.ws.on('close', () => {
      console.warn('[UserDataStream] ⚠️ Bybit connection closed');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[UserDataStream] ❌ Bybit WebSocket error:', err.message);
    });
  }

  private authBybit(apiKey: string, apiSecret: string): void {
    const expires = Date.now() + 10000;
    const signature = createHmac('sha256', apiSecret)
      .update(`GET/realtime${expires}`)
      .digest('hex');

    const authMsg = {
      op: 'auth',
      args: [apiKey, expires, signature]
    };
    this.ws?.send(JSON.stringify(authMsg));

    // Subscribe to order updates
    setTimeout(() => {
      this.ws?.send(JSON.stringify({
        op: 'subscribe',
        args: ['order']
      }));
    }, 500);
  }

  private handleBybitMessage(data: any): void {
    if (data.topic === 'order' && data.data) {
      for (const order of data.data) {
        const symbol = order.symbol;
        const orderId = order.orderId;
        const status = order.orderStatus; // Filled, Cancelled, etc.

        if (status === 'Filled') {
          console.log(`[UserDataStream] 🎯 Order FILLED on Bybit: ${symbol} (${orderId})`);
          this.hybridExit.handleOrderFill(symbol, orderId).catch(err => {
            console.error(`[UserDataStream] Error in fill handler:`, err.message);
          });
        }
      }
    }
  }
}
