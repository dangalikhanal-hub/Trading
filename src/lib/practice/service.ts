import { Prisma, type PaperOrder } from "@prisma/client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { marketProvider } from "@/lib/market/provider";
import { instruments, quoteIsFresh, type Quote } from "@/lib/market/types";
import { D, money, positive, parseOrder, calculateFill, executablePrice, markedPosition, protection, PracticeError, type OrderInput } from "./domain";

type Tx = Prisma.TransactionClient;
const openStatuses = ["PENDING", "OPEN"] as const;
const isOpen = { in: [...openStatuses] };
const defaults = () => positive(process.env.PRACTICE_INITIAL_BALANCE || "100000", 4);
const basisPoints = (key: string) => {
  const value = Number(process.env[key] || 0);
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new PracticeError(`Invalid ${key} configuration.`, 503);
  return value;
};
async function serial<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }); }
    catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
      throw error;
    }
  }
}
async function account(tx: Tx, userId: string) {
  const initialBalance = defaults();
  const row = await tx.paperAccount.upsert({ where: { userId }, update: {}, create: { userId, initialBalance, cashBalance: initialBalance, dayStartEquity: initialBalance, dayKey: new Date().toISOString().slice(0, 10), leverageLimit: 1 } });
  if (!row.isSimulated || row.currency !== "USD") throw new PracticeError("This account is not a USD practice account.", 403);
  return row;
}
export async function getQuotes() {
  const quotes: Record<string, Quote> = {}, errors: Record<string, string> = {};
  await Promise.all(instruments.map(async item => {
    try { quotes[item.symbol] = await marketProvider.quote(item.symbol); }
    catch (error) { errors[item.symbol] = error instanceof Error ? error.message : "Market data unavailable."; }
  }));
  return { quotes, errors };
}
function domainOrder(order: PaperOrder): OrderInput {
  return { mode: "PRACTICE", symbol: order.symbol, side: order.side, type: order.type, quantity: order.quantity.toString(),
    limitPrice: order.limitPrice?.toString(), stopPrice: order.stopPrice?.toString(), stopLossPrice: order.stopLossPrice?.toString(), takeProfitPrice: order.takeProfitPrice?.toString() };
}
async function release(tx: Tx, order: PaperOrder, status: "CANCELLED" | "REJECTED", reason?: string) {
  await tx.paperOrder.update({ where: { id: order.id }, data: { status, reservedNotional: 0, rejectionReason: reason } });
  await tx.paperAccount.update({ where: { id: order.paperAccountId }, data: { reservedMargin: { decrement: order.reservedNotional } } });
}
async function tryFill(tx: Tx, order: PaperOrder, quote: Quote) {
  if (!quoteIsFresh(quote) || quote.symbol !== order.symbol) return;
  const input = domainOrder(order);
  const result = executablePrice({ ...input, triggered: !!order.triggeredAt }, quote, order.simulatedSlippage.toString());
  if (result.triggered && !order.triggeredAt) await tx.paperOrder.update({ where: { id: order.id }, data: { triggeredAt: new Date() } });
  if (!result.price) return;
  const owner = await tx.paperAccount.findUniqueOrThrow({ where: { id: order.paperAccountId } });
  if (!owner.isSimulated) throw new PracticeError("Practice account required.", 403);
  const position = await tx.paperPosition.findUnique({ where: { paperAccountId_symbol_side: { paperAccountId: owner.id, symbol: order.symbol, side: "LONG" } } });
  let fill;
  try {
    if (input.side === "BUY") {
      protection(input, result.price);
      const cost = money(order.quantity.mul(result.price));
      if (cost.plus(money(cost.mul(order.feeBps).div(10000))).gt(owner.cashBalance.minus(owner.reservedMargin).plus(order.reservedNotional))) throw new PracticeError("Insufficient virtual buying power at the current execution price.");
    }
    fill = calculateFill({ cash: owner.cashBalance.toString(), quantity: position?.quantity.toString() ?? "0", entry: position?.entryPrice.toString() ?? "0", costBasis: position?.marginUsed.toString() ?? "0", side: order.side, fillQuantity: order.quantity.toString(), price: result.price.toString(), feeBps: order.feeBps });
  } catch (error) {
    if (!(error instanceof PracticeError)) throw error;
    await release(tx, order, "REJECTED", error.message); return;
  }
  await tx.paperAccount.update({ where: { id: owner.id }, data: { cashBalance: fill.cash, reservedMargin: { decrement: order.reservedNotional } } });
  if (fill.quantity.eq(0)) {
    if (position) await tx.paperPosition.delete({ where: { id: position.id } });
  } else {
    const data = { quantity: fill.quantity, entryPrice: fill.entry, currentPrice: D(quote.bid), marginUsed: fill.basis,
      unrealizedPnl: money(fill.quantity.mul(quote.bid).minus(fill.basis)), realizedPnl: (position?.realizedPnl ?? D(0)).plus(fill.realized),
      ...(order.side === "BUY" && (order.stopLossPrice || order.takeProfitPrice) ? { stopLossPrice: order.stopLossPrice, takeProfitPrice: order.takeProfitPrice } : {}) };
    await tx.paperPosition.upsert({ where: { paperAccountId_symbol_side: { paperAccountId: owner.id, symbol: order.symbol, side: "LONG" } },
      create: { paperAccountId: owner.id, symbol: order.symbol, side: "LONG", ...data }, update: data });
  }
  await tx.paperOrder.update({ where: { id: order.id }, data: { status: "FILLED", filledQuantity: order.quantity, reservedNotional: 0, filledAt: new Date() } });
  await tx.paperTrade.create({ data: { paperAccountId: owner.id, orderId: order.id, symbol: order.symbol, side: order.side, price: result.price, quantity: order.quantity, quoteQuantity: fill.notional, fee: fill.fee, realizedPnl: fill.realized, entryPrice: order.side === "SELL" ? position?.entryPrice : result.price } });
  await tx.auditLog.create({ data: { userId: owner.userId, action: "PRACTICE_FILL", details: { orderId: order.id, symbol: order.symbol, price: result.price.toString(), quantity: order.quantity.toString(), source: quote.source, quoteTime: quote.time } } });
}

export async function syncPractice(userId: string) {
  const market = await getQuotes();
  return serial(async tx => {
    const owner = await account(tx, userId);
    // Evaluate only current observed quotes. Do not invent fills for crossed prices while offline.
    const pending = await tx.paperOrder.findMany({ where: { paperAccountId: owner.id, status: isOpen }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    for (const order of pending) if (market.quotes[order.symbol]) await tryFill(tx, order, market.quotes[order.symbol]);
    const protectedPositions = await tx.paperPosition.findMany({ where: { paperAccountId: owner.id } });
    for (const pos of protectedPositions) {
      const quote = market.quotes[pos.symbol];
      if (!quote || !quoteIsFresh(quote)) continue;
      if (!(pos.stopLossPrice && D(quote.bid).lte(pos.stopLossPrice)) && !(pos.takeProfitPrice && D(quote.bid).gte(pos.takeProfitPrice))) continue;
      // Position-level OCO protection replaces pending orders for this symbol, avoiding oversells.
      const siblings = await tx.paperOrder.findMany({ where: { paperAccountId: owner.id, symbol: pos.symbol, status: isOpen } });
      for (const sibling of siblings) await release(tx, sibling, "CANCELLED");
      const close = await tx.paperOrder.create({ data: { paperAccountId: owner.id, clientOrderId: `protection:${pos.id}:${pos.updatedAt.getTime()}`, symbol: pos.symbol, side: "SELL", type: "MARKET", quantity: pos.quantity, reduceOnly: true, feeBps: basisPoints("PRACTICE_FEE_BPS"), simulatedSlippage: D(basisPoints("PRACTICE_SLIPPAGE_BPS")).div(10000) } });
      await tryFill(tx, close, quote);
    }
    return snapshot(tx, owner.id, market);
  });
}

async function snapshot(tx: Tx, id: string, market: Awaited<ReturnType<typeof getQuotes>>) {
  let owner = await tx.paperAccount.findUniqueOrThrow({ where: { id } });
  const positions = await tx.paperPosition.findMany({ where: { paperAccountId: id }, orderBy: { symbol: "asc" } });
  const recentOrders = await tx.paperOrder.findMany({ where: { paperAccountId: id }, include: { trades: { select: { price: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const pendingOrders = await tx.paperOrder.findMany({ where: { paperAccountId: id, status: isOpen }, include: { trades: { select: { price: true } } } });
  const orders = [...new Map([...recentOrders, ...pendingOrders].map(order => [order.id, order])).values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(order => ({ ...order, filledPrice: order.trades[0]?.price ?? null }));
  const trades = await tx.paperTrade.findMany({ where: { paperAccountId: id }, include: { order: { select: { type: true, status: true } } }, orderBy: { executedAt: "desc" }, take: 200 });
  const totals = await tx.paperTrade.aggregate({ where: { paperAccountId: id }, _sum: { realizedPnl: true, fee: true } });
  const [wins, losses, closed] = await Promise.all([
    tx.paperTrade.count({ where: { paperAccountId: id, side: "SELL", realizedPnl: { gt: 0 } } }),
    tx.paperTrade.count({ where: { paperAccountId: id, side: "SELL", realizedPnl: { lt: 0 } } }),
    tx.paperTrade.count({ where: { paperAccountId: id, side: "SELL" } }),
  ]);
  let complete = true, marketValue = D(0), unrealized = D(0);
  const rows = positions.map(pos => {
    const quote = market.quotes[pos.symbol];
    const mark = quote ? markedPosition(pos.quantity.toString(), pos.marginUsed.toString(), quote) : null;
    if (!mark) complete = false;
    else { marketValue = marketValue.plus(mark.value); unrealized = unrealized.plus(mark.unrealized); }
    return { ...pos, currentPrice: mark ? quote.bid : null, marketValue: mark?.value ?? null, unrealizedPnl: mark?.unrealized ?? null, returnPercent: mark?.percent ?? null };
  });
  const equity = complete ? money(owner.cashBalance.plus(marketValue)) : null;
  const dayKey = new Date().toISOString().slice(0, 10);
  if (equity && owner.dayKey !== dayKey) owner = await tx.paperAccount.update({ where: { id }, data: { dayKey, dayStartEquity: equity } });
  return { mode: "PRACTICE", account: owner, positions: rows, orders, trades, ...market,
    metrics: { equity, marketValue: complete ? marketValue : null, unrealized: complete ? unrealized : null,
      realized: totals._sum.realizedPnl ?? D(0), fees: totals._sum.fee ?? D(0), buyingPower: money(owner.cashBalance.minus(owner.reservedMargin)),
      todayPnl: equity ? money(equity.minus(owner.dayStartEquity)) : null, totalPnl: equity ? money(equity.minus(owner.initialBalance)) : null,
      wins, losses, closed, winRate: closed ? D(wins).div(closed).mul(100).toFixed(1) : null },
    conditionalExecution: "Observed fresh quotes only; evaluated while the workspace is open. UTC daily P/L starts at the first valuation of each day. History shows the most recent 200 rows." };
}

interface Preview { userId: string; accountId: string; clientOrderId: string; expires: number; order: OrderInput; estimatedPrice: string; feeBps: number; slippage: string }
function sign(payload: string) {
  if (!process.env.AUTH_SECRET) throw new PracticeError("AUTH_SECRET is required for practice confirmations.", 503);
  return createHmac("sha256", process.env.AUTH_SECRET).update(`practice-preview:${payload}`).digest("base64url");
}
export async function previewOrder(userId: string, raw: unknown) {
  const order = parseOrder(raw), quote = await marketProvider.quote(order.symbol);
  if (!quoteIsFresh(quote)) throw new PracticeError("Quote is stale or market unavailable. Try again.", 503);
  const feeBps = basisPoints("PRACTICE_FEE_BPS"), slippage = D(basisPoints("PRACTICE_SLIPPAGE_BPS")).div(10000).toString();
  const estimate = money(order.limitPrice || order.stopPrice || (order.side === "BUY" ? quote.ask : quote.bid));
  if (money(estimate.mul(order.quantity)).lte(0)) throw new PracticeError("Order value is below the minimum currency precision.");
  const risk = order.side === "BUY" ? protection(order, estimate) : { loss: null, profit: null, ratio: null };
  const owner = await serial(tx => account(tx, userId));
  let estimatedPnl: Prisma.Decimal | null = null;
  if (order.side === "SELL") {
    const position = await prisma.paperPosition.findUnique({ where: { paperAccountId_symbol_side: { paperAccountId: owner.id, symbol: order.symbol, side: "LONG" } } });
    if (!position) throw new PracticeError("No practice position to sell.");
    estimatedPnl = calculateFill({ cash: owner.cashBalance.toString(), quantity: position.quantity.toString(), entry: position.entryPrice.toString(), costBasis: position.marginUsed.toString(), side: "SELL", fillQuantity: order.quantity, price: estimate.toString(), feeBps }).realized;
  }
  const payload: Preview = { userId, accountId: owner.id, clientOrderId: randomUUID(), expires: Date.now() + 60_000, order, estimatedPrice: estimate.toString(), feeBps, slippage };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, expiresAt: new Date(payload.expires).toISOString(), order, estimatedPrice: estimate, estimatedValue: money(estimate.mul(order.quantity)), estimatedFee: money(estimate.mul(order.quantity).mul(feeBps).div(10000)), estimatedPnl, ...risk, quoteTime: quote.time, note: "Virtual USD only. Actual simulated fill may differ. Protection applies to the whole symbol position; conditional orders run only while this workspace is open." };
}
export function verifyPreview(userId: string, token: unknown): Preview {
  if (typeof token !== "string" || token.length > 5000) throw new PracticeError("Invalid confirmation.");
  const [encoded, signature, extra] = token.split(".");
  const expected = sign(encoded || "");
  if (!signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(signature) || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new PracticeError("Invalid confirmation.", 403);
  let payload: Preview;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString()); } catch { throw new PracticeError("Invalid confirmation."); }
  if (payload.userId !== userId || !Number.isFinite(payload.expires) || payload.expires < Date.now()) throw new PracticeError("Confirmation expired. Preview the order again.", 409);
  payload.order = parseOrder(payload.order);
  return payload;
}
export async function placeOrder(userId: string, token: unknown) {
  const preview = verifyPreview(userId, token), input = preview.order;
  const quote = await marketProvider.quote(input.symbol);
  if (!quoteIsFresh(quote)) throw new PracticeError("Market quote is stale. No order submitted.", 503);
  if (input.type === "MARKET" && D(input.side === "BUY" ? quote.ask : quote.bid).minus(preview.estimatedPrice).abs().div(preview.estimatedPrice).gt("0.01")) throw new PracticeError("Price moved over 1%. Preview the order again.", 409);
  return serial(async tx => {
    const owner = await account(tx, userId);
    if (owner.id !== preview.accountId) throw new PracticeError("Account was reset. Preview the order again.", 409);
    const existing = await tx.paperOrder.findUnique({ where: { paperAccountId_clientOrderId: { paperAccountId: owner.id, clientOrderId: preview.clientOrderId } } });
    if (existing) return existing;
    const count = await tx.paperOrder.count({ where: { paperAccountId: owner.id, status: isOpen } });
    if (count >= 100) throw new PracticeError("Cancel pending orders before placing more (maximum 100).");
    let reserve = D(0);
    if (input.side === "BUY") {
      const price = D(input.limitPrice || (input.type === "STOP_MARKET" ? Prisma.Decimal.max(input.stopPrice || "0", quote.ask).mul("1.02") : D(quote.ask).mul(D(1).plus(preview.slippage))));
      reserve = price.mul(input.quantity).mul(D(1).plus(D(preview.feeBps).div(10000))).toDecimalPlaces(4, Prisma.Decimal.ROUND_CEIL);
      if (reserve.gt(owner.cashBalance.minus(owner.reservedMargin))) throw new PracticeError("Insufficient virtual buying power.");
    } else {
      const position = await tx.paperPosition.findUnique({ where: { paperAccountId_symbol_side: { paperAccountId: owner.id, symbol: input.symbol, side: "LONG" } } });
      const pending = await tx.paperOrder.aggregate({ where: { paperAccountId: owner.id, symbol: input.symbol, side: "SELL", status: isOpen }, _sum: { quantity: true } });
      if (D(input.quantity).gt((position?.quantity ?? D(0)).minus(pending._sum.quantity ?? 0))) throw new PracticeError("Insufficient unreserved position quantity. Cancel pending sell orders first.");
    }
    await tx.paperAccount.update({ where: { id: owner.id }, data: { reservedMargin: { increment: reserve } } });
    const order = await tx.paperOrder.create({ data: { paperAccountId: owner.id, clientOrderId: preview.clientOrderId, symbol: input.symbol, side: input.side, type: input.type, quantity: input.quantity, limitPrice: input.limitPrice, stopPrice: input.stopPrice, stopLossPrice: input.stopLossPrice, takeProfitPrice: input.takeProfitPrice, reservedNotional: reserve, feeBps: preview.feeBps, simulatedSlippage: preview.slippage, reduceOnly: input.side === "SELL" } });
    await tx.auditLog.create({ data: { userId, action: "PRACTICE_ORDER_CONFIRMED", details: { orderId: order.id, mode: "PRACTICE" } } });
    await tryFill(tx, order, quote);
    return tx.paperOrder.findUniqueOrThrow({ where: { id: order.id } });
  });
}
export async function cancelOrder(userId: string, id: string) {
  return serial(async tx => {
    const owner = await account(tx, userId);
    const order = await tx.paperOrder.findFirst({ where: { id, paperAccountId: owner.id } });
    if (!order) throw new PracticeError("Order not found.", 404);
    if (!openStatuses.includes(order.status as typeof openStatuses[number])) throw new PracticeError("Only pending orders can be cancelled.", 409);
    await release(tx, order, "CANCELLED");
    await tx.auditLog.create({ data: { userId, action: "PRACTICE_ORDER_CANCELLED", details: { orderId: id } } });
    return { success: true };
  });
}
export async function resetAccount(userId: string, rawBalance: unknown) {
  const balance = positive(rawBalance ?? defaults(), 4);
  if (D(balance).lt(100)) throw new PracticeError("Starting balance must be at least $100.");
  return serial(async tx => {
    const owner = await account(tx, userId);
    await tx.paperAccount.delete({ where: { id: owner.id } });
    const created = await tx.paperAccount.create({ data: { userId, initialBalance: balance, cashBalance: balance, dayStartEquity: balance, dayKey: new Date().toISOString().slice(0, 10), leverageLimit: 1 } });
    await tx.auditLog.create({ data: { userId, action: "PRACTICE_ACCOUNT_RESET", details: { oldAccountId: owner.id, accountId: created.id, initialBalance: balance, mode: "PRACTICE" } } });
    return { success: true, accountId: created.id };
  });
}
