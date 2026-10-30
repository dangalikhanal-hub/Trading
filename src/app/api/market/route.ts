import { practiceRequest } from "@/lib/practice/http";
import { PracticeError } from "@/lib/practice/domain";
import { marketProvider } from "@/lib/market/provider";
import { instruments, validSymbol, validTimeframe } from "@/lib/market/types";
import { getQuotes } from "@/lib/practice/service";
export function GET(request: Request) {
  return practiceRequest(request, false, async () => {
    const params = new URL(request.url).searchParams;
    if (params.get("action") === "symbols") return { instruments: instruments.filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes((params.get("q") || "").toLowerCase())) };
    if (params.get("action") === "quotes") return getQuotes();
    const symbol = params.get("symbol") || "BTC-USD", timeframe = params.get("timeframe") || "1H";
    if (!validSymbol(symbol) || !validTimeframe(timeframe)) throw new PracticeError("Unsupported symbol or timeframe.");
    const end = params.has("end") ? Number(params.get("end")) : undefined;
    if (end !== undefined && (!Number.isInteger(end) || end < 1262304000 || end > Date.now() / 1000 + 60)) throw new PracticeError("Invalid candle end time.");
    return { symbol, timeframe, source: "Coinbase Exchange", delivery: "REST polling", candles: await marketProvider.candles(symbol, timeframe, end) };
  });
}
