import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allowAuthAttempt } from "@/lib/auth-rate-limit";
import { hasTrustedOrigin } from "@/lib/request-security";
import { parseWatchlistAction } from "@/lib/watchlists";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  try {
    const watchlists = await prisma.watchlist.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, items: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }, { id: "asc" }],
        select: { symbol: true, assetType: true },
      } },
    });
    return NextResponse.json({ watchlists }, { headers });
  } catch {
    return NextResponse.json({ error: "Watchlists are unavailable. Please try again." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const action = parseWatchlistAction(input);
  if (!action) return NextResponse.json({ error: "Invalid watchlist action, name, or symbol." }, { status: 400, headers });
  const userId = session.user.id;
  try {
    if (!(await allowAuthAttempt(`watchlists:${userId}`, 120, 60_000))) {
      return NextResponse.json({ error: "Too many changes. Try again in a minute." }, { status: 429, headers });
    }
    const result = await prisma.$transaction(async tx => {
      if (action.action === "create") {
        if (await tx.watchlist.count({ where: { userId } }) >= 20) {
          return { error: "Maximum of 20 watchlists reached.", status: 409 };
        }
        const list = await tx.watchlist.create({ data: { userId, name: action.name }, select: { id: true } });
        return { id: list.id, status: 201 };
      }
      const list = await tx.watchlist.findFirst({ where: { id: action.watchlistId, userId }, select: { id: true } });
      if (!list) return { error: "Watchlist not found.", status: 404 };
      if (action.action === "delete") {
        await tx.watchlist.delete({ where: { id: list.id } });
      } else if (action.action === "remove") {
        await tx.watchlistItem.deleteMany({ where: { watchlistId: list.id, symbol: action.symbol } });
      } else {
        const existing = await tx.watchlistItem.findUnique({
          where: { watchlistId_symbol: { watchlistId: list.id, symbol: action.symbol } }, select: { id: true },
        });
        if (!existing) {
          const count = await tx.watchlistItem.count({ where: { watchlistId: list.id } });
          if (count >= 100) return { error: "Maximum of 100 symbols per list reached.", status: 409 };
          await tx.watchlistItem.create({ data: { watchlistId: list.id, symbol: action.symbol, assetType: action.assetType, sortOrder: count } });
        }
      }
      return { id: list.id, status: 200 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result.error ? { error: result.error } : { id: result.id }, { status: result.status, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: "Watchlist changed concurrently. Refresh and try again." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Unable to save watchlist. Please try again." }, { status: 503, headers });
  }
}
