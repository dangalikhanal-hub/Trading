import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultBalances = [
  { currency: "NPR", balance: "1000000" },
  { currency: "USDT", balance: "10000" },
];

export async function ensureWallets(userId: string, reset = false) {
  return prisma.$transaction(
    defaultBalances.map(({ currency, balance }) =>
      prisma.wallet.upsert({
        where: { userId_currency: { userId, currency } },
        update: reset ? { balance: new Prisma.Decimal(balance) } : {},
        create: { userId, currency, balance: new Prisma.Decimal(balance) },
      }),
    ),
  );
}
