import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
  }
  const wallets = await prisma.wallet.findMany({ where: { userId: session.user.id } });
  return NextResponse.json(wallets);
}