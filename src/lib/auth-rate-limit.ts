import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function allowAuthAttempt(key: string, limit: number, windowMs: number) {
  const id = createHash("sha256").update(key).digest("hex");
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const [, counter] = await prisma.$transaction([
    prisma.authRateLimit.updateMany({
      where: { id, resetAt: { lte: now } },
      data: { attempts: 0, resetAt },
    }),
    prisma.authRateLimit.upsert({
      where: { id },
      create: { id, attempts: 1, resetAt },
      update: { attempts: { increment: 1 } },
    }),
  ]);
  return counter.attempts <= limit;
}
