import { auth } from "@/auth";
import { ensureWallets } from "@/lib/wallets";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  await ensureWallets(session.user.id, true);
  return NextResponse.json({ success: true });
}
