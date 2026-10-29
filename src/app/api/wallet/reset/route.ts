import { auth } from "@/auth";
import { ensureWallets } from "@/lib/wallets";
import { NextResponse } from "next/server";
import { hasTrustedOrigin } from "@/lib/request-security";
import { allowAuthAttempt } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  try {
    if (!(await allowAuthAttempt(`wallet-reset:${session.user.id}`, 5, 60_000))) {
      return NextResponse.json({ error: "Too many resets. Try again in a minute." }, { status: 429 });
    }
    await ensureWallets(session.user.id, true);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unable to reset virtual balances. Please try again." }, { status: 503 });
  }
}
