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
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const credentials = parseCredentials(input as Record<string, unknown>);
  if (!credentials) {
    return NextResponse.json({ error: "Enter a valid email and a password of 12–128 characters." }, { status: 400 });
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: credentials.email },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists. Try signing in instead." }, { status: 409 });
  }

  const existingRequest = await prisma.registrationRequest.findUnique({
    where: { email: credentials.email },
    select: { status: true },
  });
  if (existingRequest?.status === "PENDING") {
    return NextResponse.json({ error: "This email already has a request awaiting approval." }, { status: 409 });
  }
  if (existingRequest?.status === "APPROVED") {
    return NextResponse.json({ error: "This email is already approved. Try signing in instead." }, { status: 409 });
  }

  const passwordHash = await hashPassword(credentials.password);
  try {
    await prisma.registrationRequest.upsert({
      where: { email: credentials.email },
      create: { name, email: credentials.email, passwordHash },
      update: { name, passwordHash, status: "PENDING", reviewedAt: null, reviewedById: null },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This email already has a request awaiting approval." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ success: true, pending: true }, { status: 201 });
}
