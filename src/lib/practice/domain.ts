import { Prisma } from "@prisma/client";
import { validSymbol, quoteIsFresh, type Quote } from "../market/types";

export const TradingMode = { PRACTICE: "PRACTICE", LIVE: "LIVE" } as const;
export class PracticeError extends Error { constructor(message: string, public status = 400) { super(message); } }
export type OrderInput = {
  mode: "PRACTICE"; symbol: string; side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_MARKET" | "STOP_LIMIT";
  quantity: string; limitPrice?: string; stopPrice?: string; stopLossPrice?: string; takeProfitPrice?: string;
};
export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const money = (value: Prisma.Decimal.Value) => D(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
export function positive(value: unknown, places: number, max = "1000000000"): string {
  if (typeof value !== "string" || !new RegExp(`^\\d{1,10}(\\.\\d{1,${places}})?$`).test(value)) throw new PracticeError(`Enter a positive decimal with up to ${places} decimal places.`);
  const number = D(value);
  if (!number.isFinite() || number.lte(0) || number.gt(max)) throw new PracticeError("Value is outside the supported range.");
  return number.toString();
}
export function parseOrder(value: unknown): OrderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PracticeError("Invalid order.");
  const v = value as Record<string, unknown>;
  if (v.mode !== TradingMode.PRACTICE) throw new PracticeError("Only PRACTICE orders are accepted. Live trading is unavailable.", 403);
  if (typeof v.symbol !== "string" || !validSymbol(v.symbol) || !["BUY", "SELL"].includes(String(v.side)) || !["MARKET", "LIMIT", "STOP_MARKET", "STOP_LIMIT"].includes(String(v.type))) throw new PracticeError("Unsupported symbol, side, or order type.");
  const order: OrderInput = { mode: "PRACTICE", symbol: v.symbol, side: v.side as OrderInput["side"], type: v.type as OrderInput["type"], quantity: positive(v.quantity, 8, "1000000") };
  for (const key of ["limitPrice", "stopPrice", "stopLossPrice", "takeProfitPrice"] as const) {
    if (v[key] !== undefined && v[key] !== "") order[key] = positive(v[key], 4);
  }
  if (["LIMIT", "STOP_LIMIT"].includes(order.type) && !order.limitPrice) throw new PracticeError("A limit price is required.");
  if (["STOP_MARKET", "STOP_LIMIT"].includes(order.type) && !order.stopPrice) throw new PracticeError("A stop price is required.");
  if (order.side === "SELL" && (order.stopLossPrice || order.takeProfitPrice)) throw new PracticeError("Position protection can be attached to buy orders only.");
  if (!["LIMIT", "STOP_LIMIT"].includes(order.type)) delete order.limitPrice;
  if (!["STOP_MARKET", "STOP_LIMIT"].includes(order.type)) delete order.stopPrice;
  return order;
}
export function executablePrice(order: Pick<OrderInput, "side" | "type" | "limitPrice" | "stopPrice"> & { triggered?: boolean }, quote: Quote, slippage = "0") {
  if (!quoteIsFresh(quote)) throw new PracticeError("Market quote is stale or the market is unavailable. No execution performed.", 503);
  const market = D(order.side === "BUY" ? quote.ask : quote.bid);
  const stopHit = order.stopPrice && (order.side === "BUY" ? market.gte(order.stopPrice) : market.lte(order.stopPrice));
  const triggered = order.triggered || !!stopHit;
  if (order.type.startsWith("STOP") && !triggered) return { triggered: false, price: null };
  const adjusted = money(market.mul(order.side === "BUY" ? D(1).plus(slippage) : D(1).minus(slippage)));
  if (order.type === "LIMIT" || order.type === "STOP_LIMIT") {
    if (!order.limitPrice || (order.side === "BUY" ? adjusted.gt(order.limitPrice) : adjusted.lt(order.limitPrice))) return { triggered, price: null };
  }
  return { triggered, price: adjusted };
}
export function calculateFill(input: { cash: string; quantity: string; entry: string; costBasis: string; side: "BUY" | "SELL"; fillQuantity: string; price: string; feeBps: number }) {
  const quantity = D(positive(input.fillQuantity, 8, "1000000"));
  const price = D(positive(input.price, 4));
  const oldQuantity = D(input.quantity), cash = D(input.cash), oldBasis = D(input.costBasis);
  const notional = money(quantity.mul(price));
  if (notional.lte(0)) throw new PracticeError("Order value is below the minimum currency precision.");
  const fee = money(notional.mul(input.feeBps).div(10000));
  if (input.side === "BUY") {
    if (notional.plus(fee).gt(cash)) throw new PracticeError("Insufficient virtual buying power.");
    const nextQuantity = oldQuantity.plus(quantity), basis = money(oldBasis.plus(notional).plus(fee));
    if (nextQuantity.gt(1000000)) throw new PracticeError("Maximum position quantity is 1,000,000 units.");
    return { cash: money(cash.minus(notional).minus(fee)), quantity: nextQuantity, entry: money(oldQuantity.mul(input.entry).plus(quantity.mul(price)).div(nextQuantity)), basis, realized: D(0), fee, notional };
  }
  if (quantity.gt(oldQuantity)) throw new PracticeError("Insufficient unreserved position quantity. Short selling is unavailable.");
  const allocatedBasis = quantity.eq(oldQuantity) ? oldBasis : money(oldBasis.mul(quantity).div(oldQuantity));
  return { cash: money(cash.plus(notional).minus(fee)), quantity: oldQuantity.minus(quantity), entry: D(input.entry), basis: money(oldBasis.minus(allocatedBasis)), realized: money(notional.minus(fee).minus(allocatedBasis)), fee, notional };
}
export function markedPosition(quantity: string, basis: string, quote: Quote) {
  if (!quoteIsFresh(quote)) return null;
  const value = money(D(quantity).mul(quote.bid));
  return { value, unrealized: money(value.minus(basis)), percent: D(basis).gt(0) ? value.minus(basis).div(basis).mul(100).toFixed(2) : "0" };
}
export function protection(order: OrderInput, entry: Prisma.Decimal) {
  if (order.stopLossPrice && D(order.stopLossPrice).gte(entry)) throw new PracticeError("Stop loss must be below the estimated entry.");
  if (order.takeProfitPrice && D(order.takeProfitPrice).lte(entry)) throw new PracticeError("Take profit must be above the estimated entry.");
  const loss = order.stopLossPrice ? money(entry.minus(order.stopLossPrice).mul(order.quantity)) : null;
  const profit = order.takeProfitPrice ? money(D(order.takeProfitPrice).minus(entry).mul(order.quantity)) : null;
  return { loss: loss?.toString() ?? null, profit: profit?.toString() ?? null, ratio: loss && profit && loss.gt(0) ? profit.div(loss).toFixed(2) : null };
}
