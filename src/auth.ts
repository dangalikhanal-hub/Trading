import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const userId = user.id as string;
      if (userId) {
        await prisma.wallet.upsert({
          where: { userId_currency: { userId, currency: "NPR" } },
          update: {},
          create: {
            userId,
            currency: "NPR",
            balance: new Prisma.Decimal("1000000"),
          },
        });
        await prisma.wallet.upsert({
          where: { userId_currency: { userId, currency: "USDT" } },
          update: {},
          create: {
            userId,
            currency: "USDT",
            balance: new Prisma.Decimal("10000"),
          },
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});