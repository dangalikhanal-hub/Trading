import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { practiceRequest, jsonBody } from "@/lib/practice/http";
import { PracticeError } from "@/lib/practice/domain";
import { validSymbol, validTimeframe } from "@/lib/market/types";
import { parseDrawings } from "@/lib/chart/drawings";
function key(symbol: unknown, timeframe: unknown) {
  if (typeof symbol !== "string" || !validSymbol(symbol) || typeof timeframe !== "string" || !validTimeframe(timeframe)) throw new PracticeError("Unsupported drawing symbol/timeframe.");
  return { symbol, timeframe };
}
export function GET(request: Request) {
  return practiceRequest(request, false, async userId => {
    const p = new URL(request.url).searchParams;
    const context = key(p.get("symbol"), p.get("timeframe"));
    const row = await prisma.chartDrawing.findUnique({ where: { userId_symbol_timeframe: { userId, ...context } } });
    return { shapes: row?.shapes ?? [], version: row?.version ?? 0 };
  });
}
export function PUT(request: Request) {
  return practiceRequest(request, true, async userId => {
    const body = await jsonBody(request), context = key(body.symbol, body.timeframe), shapes = parseDrawings(body.shapes);
    if (!shapes || !Number.isInteger(body.version) || Number(body.version) < 0) throw new PracticeError("Invalid drawing data.");
    try {
      if (body.version === 0) {
        await prisma.chartDrawing.create({ data: { userId, ...context, shapes: shapes as unknown as Prisma.InputJsonValue } });
      } else {
        const updated = await prisma.chartDrawing.updateMany({ where: { userId, ...context, version: Number(body.version) }, data: { shapes: shapes as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
        if (!updated.count) throw new PracticeError("Drawings changed in another tab. Reload before saving.", 409);
      }
      return { version: Number(body.version) + 1 };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PracticeError("Drawings changed in another tab. Reload before saving.", 409);
      throw error;
    }
  });
}
