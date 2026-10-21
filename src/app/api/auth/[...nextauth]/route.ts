import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const authOptions = {
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
    // optional: error, signOut, etc.
  },
  // Enable JWT sessions for easy access in API routes
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      // Ensure demo wallets exist for the user
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
      // Attach user id to session for easier access
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};


export const GET = NextAuth(authOptions).GET;
export const POST = NextAuth(authOptions).POST;
