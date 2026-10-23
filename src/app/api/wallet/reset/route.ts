"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
  }
  const userId = session.user.id as string;
  await prisma.wallet.updateMany({
    where: { userId, currency: "NPR" },
    data: { balance: new Prisma.Decimal("1000000") },
  });
  await prisma.wallet.updateMany({
    where: { userId, currency: "USDT" },
    data: { balance: new Prisma.Decimal("10000") },
  });
  return NextResponse.json({ success: true });
}