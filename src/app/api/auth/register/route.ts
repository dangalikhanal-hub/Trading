import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, parseCredentials } from "@/lib/passwords";
import { allowAuthAttempt, clientAddress } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin;
  if (!origin || origin !== expectedOrigin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!(await allowAuthAttempt(`register:${clientAddress(request)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const credentials = input && typeof input === "object" && !Array.isArray(input) ? parseCredentials(input) : null;
  if (!credentials) {
    return NextResponse.json({ error: "Enter a valid email and a password of 12–128 characters." }, { status: 400 });
  }
  const passwordHash = await hashPassword(credentials.password);
  try {
    await prisma.user.create({
      data: {
        email: credentials.email,
        passwordHash,
        wallets: { create: [
          { currency: "NPR", balance: "1000000" },
          { currency: "USDT", balance: "10000" },
        ] },
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Unable to create an account with these details. Try signing in instead." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
