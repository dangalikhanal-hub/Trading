/**
 * MTrade - Production-Grade Order Management System (OMS) & Pre-Trade Risk Engine
 * Language: TypeScript
 * 
 * Includes:
 * 1. Strict Domain Data Models & Schemas
 * 2. Deterministic Pre-Trade Risk Engine (Idempotency, Fat-Finger, Margin Reservation)
 * 3. Atomic Finite State Machine (FSM) Order Lifecycle Manager
 */

// ============================================================================
// 1. DOMAIN ENUMS & TYPES
// ============================================================================

export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_LOSS'
  | 'TRAILING_STOP';

export type TimeInForce = 
  | 'GTC' // Good 'Til Cancelled
  | 'IOC' // Immediate or Cancel
  | 'FOK'; // Fill or Kill

export type OrderStatus = 
  | 'NEW'
  | 'PENDING'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED';

export type MarginType = 'ISOLATED' | 'CROSS';

// ============================================================================
// 2. DATA MODELS / SCHEMAS
// ============================================================================

/**
 * Core Order Model
 * Handles Limit, Market, Stop-Loss, Trailing-Stop with execution telemetry
 */
export interface Order {
  id: string;                       // Internal exchange UUID
  clientOrderId: string;             // Client-supplied idempotency key
  userId: string;                    // Account owner identifier
  symbol: string;                    // e.g., "BTC-USDT"
  side: OrderSide;                   // BUY | SELL
  type: OrderType;                   // LIMIT | MARKET | STOP_LOSS | TRAILING_STOP
  timeInForce: TimeInForce;          // GTC | IOC | FOK
  
  // Pricing & Quantities
  price?: number;                    // Required for LIMIT orders
  quantity: number;                  // Order amount in base asset
  stopPrice?: number;                // Trigger price for STOP_LOSS
  trailingDeltaPercent?: number;     // Trailing delta for TRAILING_STOP (e.g. 1.5%)
  
  // Execution Telemetry
  status: OrderStatus;
  version: number;                   // For Optimistic Concurrency Control (OCC)
  cumulativeFilledQty: number;       // Filled amount so far
  cumulativeQuoteQty: number;        // Quote asset turnover filled (USDT)
  averageFillPrice?: number;         // Weighted average fill price
  feePaid: number;                   // Accumulated trading fee
  
  reduceOnly: boolean;               // If true, position can only be closed/reduced
  createdAt: number;                 // Epoch milliseconds
  updatedAt: number;
}

/**
 * Trade Execution (Fill) Record
 */
export interface TradeExecution {
  tradeId: string;                   // Unique execution ID
  orderId: string;                   // Maker or Taker order ID
  matchOrderId: string;              // Counterparty order ID
  userId: string;
  symbol: string;
  side: OrderSide;
  price: number;                     // Exact executed fill price
  quantity: number;                  // Executed fill quantity
  quoteQuantity: number;             // price * quantity
  fee: number;                       // Fee amount paid
  feeAsset: string;                  // e.g., "USDT" or "BNB"
  role: 'MAKER' | 'TAKER';           // Liquidity classification
  timestamp: number;
}

/**
 * Account Balance Model
 */
export interface AccountBalance {
  asset: string;                     // e.g. "USDT", "BTC"
  total: number;                     // total = available + locked
  available: number;                 // Free collateral eligible for new orders
  locked: number;                    // Collateral reserved by active resting orders
  updatedAt: number;
}

/**
 * Perpetual Futures Position Model
 */
export interface Position {
  symbol: string;                    // e.g. "BTC-USDT"
  userId: string;
  side: 'LONG' | 'SHORT' | 'FLAT';
  quantity: number;                  // Position size
  entryPrice: number;                // Volume-weighted average entry price
  leverage: number;                  // Active leverage tier (e.g., 20x)
  marginType: MarginType;            // ISOLATED or CROSS
  initialMargin: number;             // Collateral committed to position
  maintenanceMargin: number;         // Min equity required before liquidation
  liquidationPrice: number;          // Estimated liquidation trigger
  unrealizedPnl: number;
  realizedPnl: number;
  updatedAt: number;
}

// ============================================================================
// 3. PRE-TRADE RISK ENGINE
// ============================================================================

export interface RiskCheckResult {
  allowed: boolean;
  rejectReason?: string;
  lockedMargin?: number;
}

export interface MarketReference {
  markPrice: number;
  bestBid: number;
  bestAsk: number;
  maxOrderNotional: number;         // Max allowed notional value (e.g. $2,000,000)
  priceDeviationLimit: number;      // Max allowed deviation (e.g. 0.05 for 5%)
  takerFeeRate: number;             // e.g. 0.0004 (0.04%)
}

export class PreTradeRiskEngine {
  // Idempotency cache: clientOrderId -> cached order result / timestamp
  private idempotencyStore = new Map<string, { orderId: string; timestamp: number }>();
  private readonly IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000; // 1-hour deduplication window

  /**
   * Evaluates pre-trade risk checks:
   * 1. Idempotency Check (Duplicate request prevention)
   * 2. Max Order Size / Fat-Finger Price Band Protection
   * 3. Free Buying Power & Margin Reservation
   */
  public evaluateOrderRisk(
    order: Order,
    balance: AccountBalance,
    position: Position | null,
    market: MarketReference,
    leverage: number = 20
  ): RiskCheckResult {

    // ------------------------------------------------------------------------
    // Rule 1: Idempotency Verification
    // ------------------------------------------------------------------------
    if (this.idempotencyStore.has(order.clientOrderId)) {
      const existing = this.idempotencyStore.get(order.clientOrderId)!;
      return {
        allowed: false,
        rejectReason: `DUPLICATE_CLIENT_ORDER_ID: Request already processed as Order [${existing.orderId}]`
      };
    }

    // ------------------------------------------------------------------------
    // Rule 2: Fat-Finger Price Band & Order Size Thresholds
    // ------------------------------------------------------------------------
    const executionPrice = order.type === 'MARKET' ? market.markPrice : (order.price || market.markPrice);
    const orderNotional = executionPrice * order.quantity;

    // Check maximum notional limit
    if (orderNotional > market.maxOrderNotional) {
      return {
        allowed: false,
        rejectReason: `ORDER_NOTIONAL_EXCEEDED: Requested notional $${orderNotional.toFixed(2)} exceeds cap of $${market.maxOrderNotional.toFixed(2)}`
      };
    }

    // Fat-Finger Price Deviation Band (for Limit orders)
    if (order.type === 'LIMIT' && order.price) {
      const deviation = Math.abs(order.price - market.markPrice) / market.markPrice;
      if (deviation > market.priceDeviationLimit) {
        return {
          allowed: false,
          rejectReason: `PRICE_DEVIATION_EXCEEDED: Limit price $${order.price} deviates by ${(deviation * 100).toFixed(2)}% from mark price $${market.markPrice} (Max allowed: ${(market.priceDeviationLimit * 100).toFixed(0)}%)`
        };
      }
    }

    // ------------------------------------------------------------------------
    // Rule 3: Buying Power & Margin Reservation
    // ------------------------------------------------------------------------
    // If order is Reduce-Only, it shrinks exposure and does not demand fresh margin
    if (order.reduceOnly) {
      if (!position || position.quantity < order.quantity) {
        return {
          allowed: false,
          rejectReason: 'REDUCE_ONLY_INVALID: Cannot reduce position without sufficient existing exposure'
        };
      }
      return { allowed: true, lockedMargin: 0 };
    }

    // Required initial margin = (Notional / Leverage) + Estimated Taker Fee
    const initialMarginRequired = orderNotional / leverage;
    const estimatedFee = orderNotional * market.takerFeeRate;
    const totalCollateralNeeded = initialMarginRequired + estimatedFee;

    if (balance.available < totalCollateralNeeded) {
      return {
        allowed: false,
        rejectReason: `INSUFFICIENT_MARGIN: Required $${totalCollateralNeeded.toFixed(2)} USDT, but only $${balance.available.toFixed(2)} USDT is available`
      };
    }

    // Commit Idempotency Entry
    this.idempotencyStore.set(order.clientOrderId, {
      orderId: order.id,
      timestamp: Date.now()
    });

    // Clean up expired idempotency keys
    this.pruneIdempotencyCache();

    return {
      allowed: true,
      lockedMargin: totalCollateralNeeded
    };
  }

  private pruneIdempotencyCache(): void {
    const now = Date.now();
    for (const [key, value] of this.idempotencyStore.entries()) {
      if (now - value.timestamp > this.IDEMPOTENCY_WINDOW_MS) {
        this.idempotencyStore.delete(key);
      }
    }
  }
}

// ============================================================================
// 4. ATOMIC ORDER STATE MACHINE (FSM)
// ============================================================================

export class OrderStateMachine {
  /**
   * Deterministic Transition Matrix
   * Defines legal state progressions. Any unlisted transition is strictly illegal.
   */
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    NEW: ['PENDING', 'REJECTED'],
    PENDING: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED'],
    PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED'],
    FILLED: [],       // Terminal State
    CANCELLED: [],    // Terminal State
    REJECTED: []      // Terminal State
  };

  /**
   * Atomically transitions an order state using Optimistic Concurrency Control (OCC).
   * 
   * @param order - The order to transition
   * @param targetStatus - Destination state
   * @param expectedVersion - Expected version number before transition
   */
  public static transition(
    order: Order, 
    targetStatus: OrderStatus, 
    expectedVersion: number
  ): Order {
    // 1. Version Match (OCC Check)
    if (order.version !== expectedVersion) {
      throw new Error(`CONCURRENCY_CONFLICT: Order [${order.id}] version mismatch. Expected ${expectedVersion}, found ${order.version}`);
    }

    // 2. Validate Against Allowed State Transitions
    const allowedTargets = this.VALID_TRANSITIONS[order.status];
    if (!allowedTargets.includes(targetStatus)) {
      throw new Error(`ILLEGAL_STATE_TRANSITION: Cannot transition Order [${order.id}] from ${order.status} to ${targetStatus}`);
    }

    // 3. Atomic State Mutation
    order.status = targetStatus;
    order.version += 1;
    order.updatedAt = Date.now();

    return order;
  }

  /**
   * Processes a Trade Execution fill against an active order
   */
  public static applyFill(
    order: Order, 
    fillQty: number, 
    fillPrice: number, 
    fee: number
  ): Order {
    if (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED') {
      throw new Error(`INVALID_FILL_STATE: Cannot fill Order [${order.id}] in status ${order.status}`);
    }

    const previousQuote = order.cumulativeFilledQty * (order.averageFillPrice || fillPrice);
    const newFillQuote = fillQty * fillPrice;

    order.cumulativeFilledQty += fillQty;
    order.cumulativeQuoteQty += newFillQuote;
    order.averageFillPrice = (previousQuote + newFillQuote) / order.cumulativeFilledQty;
    order.feePaid += fee;
    order.updatedAt = Date.now();

    // Determine if filled or partially filled
    const isFullyFilled = order.cumulativeFilledQty >= order.quantity - 0.00000001; // float precision epsilon
    const nextStatus: OrderStatus = isFullyFilled ? 'FILLED' : 'PARTIALLY_FILLED';

    order.status = nextStatus;
    order.version += 1;

    return order;
  }
}
