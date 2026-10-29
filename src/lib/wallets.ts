import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultBalances = [
  { currency: "NPR", balance: "1000000" },
  { currency: "USDT", balance: "10000" },
];

export async function ensureWallets(userId: string, reset = false) {
  return prisma.$transaction(async tx => {
    const wallets = await Promise.all(defaultBalances.map(({ currency, balance }) =>
      tx.wallet.upsert({
        where: { userId_currency: { userId, currency } },
        update: reset ? { balance: new Prisma.Decimal(balance) } : {},
        create: { userId, currency, balance: new Prisma.Decimal(balance) },
      }),
    ));
    if (reset) await tx.auditLog.create({ data: {
      userId, action: "BALANCE_RESET", details: { mode: "PAPER", balances: defaultBalances },
    } });
    return wallets;
  });
}
