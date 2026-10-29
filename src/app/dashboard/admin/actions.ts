"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ReviewState = {
  error?: string;
  success?: string;
};

export async function reviewRegistration(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  void _previous;
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { error: "Only an administrator can review registration requests." };
  }

  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!id || (intent !== "approve" && intent !== "reject")) {
    return { error: "Invalid request." };
  }

  const request = await prisma.registrationRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING") {
    return { error: "This request is no longer pending." };
  }

  const reviewedAt = new Date();

  if (intent === "reject") {
    const result = await prisma.registrationRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", reviewedAt, reviewedById: user.id },
    });
    if (result.count === 0) return { error: "This request was already reviewed." };
    revalidatePath("/dashboard/admin");
    return { success: "Request rejected." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: request.email },
    select: { id: true },
  });
  if (existingUser) {
    return { error: "An account with this email already exists. Reject this request instead." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.registrationRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt, reviewedById: user.id },
      });
      if (claimed.count === 0) throw new Error("ALREADY_REVIEWED");

      await tx.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: "TRADER",
          wallets: {
            create: [
              { currency: "NPR", balance: "1000000" },
              { currency: "USDT", balance: "10000" },
            ],
          },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") {
      return { error: "This request was already reviewed." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists. Reject this request instead." };
    }
    throw error;
  }

  revalidatePath("/dashboard/admin");
  return { success: "Account approved and created." };
}
