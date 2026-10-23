/**
 * MTrade - Production Real-Time Market Data Pipeline
 * 
 * Components:
 * 1. Normalized Tick Schema & Ingestion Interface
 * 2. In-Memory 1-Second & 1-Minute OHLCV Dynamic Aggregator
 * 3. High-Performance Level 2 (DOM) Order Book with Sequence Gap Validation
 * 4. Conflation Engine for Low-Latency Frontend Broadcasts
 */

// ============================================================================
// 1. DATA MODELS & UNIFIED NORMALIZED SCHEMAS
// ============================================================================

export type MarketSide = 'BUY' | 'SELL';

/**
 * Normalized Tick / Trade Model
 * Standardized across all external venues (Binance, Coinbase, FIX, etc.)
 */
export interface NormalizedTick {
  symbol: string;             // e.g. "BTC-USDT"
  source: string;             // e.g. "BINANCE_PERP", "COINBASE", "LMAX_FIX"
  tradeId: string;            // Unique venue trade ID
  side: MarketSide;           // Aggressor side
  price: number;              // Execution price (or fixed-point integer)
  quantity: number;           // Quantity in base asset
  quoteQuantity: number;      // price * quantity (turnover)
  exchangeTimestamp: number;  // Matching engine timestamp (ms or ns)
  ingressTimestamp: number;   // Ingress timestamp at our gateway (ms)
}

/**
 * Standard OHLCV Candle Bar
 */
export interface CandleBar {
  symbol: string;
  resolution: '1s' | '1m';
  openTime: number;           // Epoch timestamp (start of window)
  closeTime: number;          // Epoch timestamp (end of window)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;             // Total base asset volume
  quoteVolume: number;        // Total quote asset turnover
  tradeCount: number;         // Total trades in candle
  vwap: number;               // Volume-Weighted Average Price
  isFinal: boolean;           // True when candle period has closed
}

/**
 * Level 2 Order Book Delta / Price Level
 */
export interface BookPriceLevel {
  price: number;
  quantity: number;
}

export interface OrderBookDelta {
  symbol: string;
  firstUpdateId: number;      // Sequence start ID
  lastUpdateId: number;       // Sequence end ID
  prevLastUpdateId?: number;  // Previous sequence ID for chain validation
  bids: BookPriceLevel[];     // Updated bid levels (quantity = 0 means remove)
  asks: BookPriceLevel[];     // Updated ask levels (quantity = 0 means remove)
  timestamp: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  lastUpdateId: number;
  bids: BookPriceLevel[];     // Sorted descending by price
  asks: BookPriceLevel[];     // Sorted ascending by price
  timestamp: number;
}

// ============================================================================
// 2. IN-MEMORY OHLCV AGGREGATOR (1s and 1m Buckets)
// ============================================================================

export class InMemoryCandleAggregator {
  // Map of symbol -> current active 1s candle
  private active1sBars = new Map<string, CandleBar>();
  // Map of symbol -> current active 1m candle
  private active1mBars = new Map<string, CandleBar>();

  private onBarClosed?: (bar: CandleBar) => void;
  private onBarUpdated?: (bar: CandleBar) => void;

  constructor(callbacks?: {
    onBarClosed?: (bar: CandleBar) => void;
    onBarUpdated?: (bar: CandleBar) => void;
  }) {
    this.onBarClosed = callbacks?.onBarClosed;
    this.onBarUpdated = callbacks?.onBarUpdated;
  }

  /**
   * Ingests a normalized tick and updates both 1s and 1m active bars
   */
  public ingestTick(tick: NormalizedTick): void {
    this.updateResolutionBar(tick, '1s', 1000, this.active1sBars);
    this.updateResolutionBar(tick, '1m', 60000, this.active1mBars);
  }

  private updateResolutionBar(
    tick: NormalizedTick,
    resolution: '1s' | '1m',
    intervalMs: number,
    storage: Map<string, CandleBar>
  ): void {
    const tickTime = tick.exchangeTimestamp;
    const bucketStart = tickTime - (tickTime % intervalMs);
    const bucketEnd = bucketStart + intervalMs - 1;

    let currentBar = storage.get(tick.symbol);

    // If no active bar or tick belongs to a new time window
    if (!currentBar || bucketStart > currentBar.openTime) {
      if (currentBar) {
        // Finalize previous candle
        currentBar.isFinal = true;
        this.onBarClosed?.(currentBar);
      }

      // Initialize new candle
      currentBar = {
        symbol: tick.symbol,
        resolution,
        openTime: bucketStart,
        closeTime: bucketEnd,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.quantity,
        quoteVolume: tick.quoteQuantity,
        tradeCount: 1,
        vwap: tick.price,
        isFinal: false
      };
      storage.set(tick.symbol, currentBar);
      this.onBarUpdated?.(currentBar);
      return;
    }

    // If tick falls within current window: update running metrics
    if (bucketStart === currentBar.openTime) {
      currentBar.high = Math.max(currentBar.high, tick.price);
      currentBar.low = Math.min(currentBar.low, tick.price);
      currentBar.close = tick.price;
      currentBar.volume += tick.quantity;
      currentBar.quoteVolume += tick.quoteQuantity;
      currentBar.tradeCount += 1;
      currentBar.vwap = currentBar.volume > 0 ? (currentBar.quoteVolume / currentBar.volume) : tick.price;
      
      this.onBarUpdated?.(currentBar);
    } 
    // Late-arriving tick handling (watermark grace period)
    else if (bucketStart < currentBar.openTime) {
      console.warn(`[Aggregator] Late tick received for ${tick.symbol}: tickTime=${tickTime}, currentBucket=${currentBar.openTime}`);
      // In production: dispatch to out-of-order patch queue for Time-Series DB reconciliation
    }
  }

  /**
   * Periodic clock flush: seals expired bars even if no tick arrived
   */
  public flushExpiredBars(currentTime: number = Date.now()): void {
    this.flushMap(currentTime, 1000, this.active1sBars);
    this.flushMap(currentTime, 60000, this.active1mBars);
  }

  private flushMap(currentTime: number, intervalMs: number, storage: Map<string, CandleBar>): void {
    for (const [symbol, bar] of storage.entries()) {
      if (currentTime > bar.closeTime && !bar.isFinal) {
        bar.isFinal = true;
        this.onBarClosed?.(bar);
        storage.delete(symbol);
      }
    }
  }
}

// ============================================================================
// 3. LEVEL 2 (DEPTH OF MARKET / DOM) ORDER BOOK ENGINE
// ============================================================================

export class Level2OrderBook {
  public symbol: string;
  public lastUpdateId: number = 0;
  private bids = new Map<number, number>(); // Price -> Quantity
  private asks = new Map<number, number>(); // Price -> Quantity

  private deltaBuffer: OrderBookDelta[] = [];
  private isSynchronized: boolean = false;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  /**
   * Step 1: Initialize with full REST snapshot
   */
  public loadSnapshot(snapshot: OrderBookSnapshot): void {
    this.bids.clear();
    this.asks.clear();
    this.lastUpdateId = snapshot.lastUpdateId;

    for (const level of snapshot.bids) {
      if (level.quantity > 0) this.bids.set(level.price, level.quantity);
    }
    for (const level of snapshot.asks) {
      if (level.quantity > 0) this.asks.set(level.price, level.quantity);
    }

    this.isSynchronized = true;

    // Apply any buffered deltas that arrived during snapshot retrieval
    this.drainBufferedDeltas();
  }

  /**
   * Step 2: Ingest continuous WebSocket deltas
   */
  public applyDelta(delta: OrderBookDelta): boolean {
    if (!this.isSynchronized) {
      // Buffer deltas while awaiting initial snapshot
      this.deltaBuffer.push(delta);
      return true;
    }

    // Ignore stale deltas prior to snapshot
    if (delta.lastUpdateId <= this.lastUpdateId) {
      return false;
    }

    // Sequence Gap Detection: verify continuity
    if (delta.prevLastUpdateId && delta.prevLastUpdateId !== this.lastUpdateId) {
      console.error(`[OrderBook ${this.symbol}] Sequence gap detected! Expected ${this.lastUpdateId}, got prevLastUpdateId=${delta.prevLastUpdateId}. Resetting book.`);
      this.isSynchronized = false;
      this.deltaBuffer = [];
      // Trigger snapshot re-sync event
      return false;
    }

    // Apply bid updates
    for (const { price, quantity } of delta.bids) {
      if (quantity === 0) {
        this.bids.delete(price); // Price level removed
      } else {
        this.bids.set(price, quantity); // Insert or update quantity
      }
    }

    // Apply ask updates
    for (const { price, quantity } of delta.asks) {
      if (quantity === 0) {
        this.asks.delete(price); // Price level removed
      } else {
        this.asks.set(price, quantity); // Insert or update quantity
      }
    }

    this.lastUpdateId = delta.lastUpdateId;
    return true;
  }

  private drainBufferedDeltas(): void {
    // Sort buffered deltas by sequence
    this.deltaBuffer.sort((a, b) => a.firstUpdateId - b.firstUpdateId);

    for (const delta of this.deltaBuffer) {
      if (delta.lastUpdateId > this.lastUpdateId) {
        this.applyDelta(delta);
      }
    }
    this.deltaBuffer = [];
  }

  /**
   * Extracts top N aggregated levels sorted for frontend display
   */
  public getTopLevels(depth: number = 20): { bids: BookPriceLevel[]; asks: BookPriceLevel[] } {
    // Bids sorted DESCENDING (highest price first)
    const sortedBids = Array.from(this.bids.entries())
      .map(([price, quantity]) => ({ price, quantity }))
      .sort((a, b) => b.price - a.price)
      .slice(0, depth);

    // Asks sorted ASCENDING (lowest price first)
    const sortedAsks = Array.from(this.asks.entries())
      .map(([price, quantity]) => ({ price, quantity }))
      .sort((a, b) => a.price - b.price)
      .slice(0, depth);

    return { bids: sortedBids, asks: sortedAsks };
  }
}

// ============================================================================
// 4. FRONTEND CONFLATION & THROTTLED DISPATCHER
// ============================================================================

export class FrontendConflationDispatcher {
  private throttledIntervalMs: number;
  private pendingUpdates = new Map<string, { book: Level2OrderBook; lastDispatchedTime: number }>();
  private timer: NodeJS.Timeout | null = null;
  private dispatchCallback: (symbol: string, topLevels: { bids: BookPriceLevel[]; asks: BookPriceLevel[] }) => void;

  /**
   * @param intervalMs Conflation window (e.g. 50ms = 20 FPS, 100ms = 10 FPS)
   */
  constructor(
    intervalMs: number = 50,
    dispatchCallback: (symbol: string, topLevels: { bids: BookPriceLevel[]; asks: BookPriceLevel[] }) => void
  ) {
    this.throttledIntervalMs = intervalMs;
    this.dispatchCallback = dispatchCallback;
    this.startDispatcherLoop();
  }

  public registerBookUpdate(book: Level2OrderBook): void {
    if (!this.pendingUpdates.has(book.symbol)) {
      this.pendingUpdates.set(book.symbol, { book, lastDispatchedTime: 0 });
    }
  }

  private startDispatcherLoop(): void {
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [symbol, entry] of this.pendingUpdates.entries()) {
        if (now - entry.lastDispatchedTime >= this.throttledIntervalMs) {
          const topLevels = entry.book.getTopLevels(25); // Top 25 depth is optimal for UI
          this.dispatchCallback(symbol, topLevels);
          entry.lastDispatchedTime = now;
        }
      }
    }, this.throttledIntervalMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
