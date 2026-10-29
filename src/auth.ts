import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { ensureWallets } from "@/lib/wallets";
import { parseCredentials, verifyPassword } from "@/lib/passwords";
import { allowAuthAttempt, clientAddress } from "@/lib/auth-rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(input, request) {
        const credentials = parseCredentials(input);
        if (!credentials) return null;
        if (!(await allowAuthAttempt(`login-ip:${clientAddress(request)}`, 30, 15 * 60 * 1000))) return null;
        if (!(await allowAuthAttempt(`login-email:${credentials.email}`, 10, 15 * 60 * 1000))) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!(await verifyPassword(credentials.password, user?.passwordHash ?? null)) || !user) return null;
        const authorized = { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
        return authorized;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  session: { strategy: "jwt" },
  events: {
    async signIn({ user }) {
      // Auth.js emits this event after the database user has been created.
      if (user.id) {
        await ensureWallets(user.id);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      const jwtToken = token as typeof token & { role?: "TRADER" | "VIP_SIMULATOR" | "ADMIN" };
      if (user) {
        const role = (user as { role?: "TRADER" | "VIP_SIMULATOR" | "ADMIN" }).role;
        if (role) jwtToken.role = role;
      }
      return jwtToken;
    },
    async session({ session, token }) {
      const user = session.user as typeof session.user & {
        id?: string;
        role?: "TRADER" | "VIP_SIMULATOR" | "ADMIN";
      };
      if (token.sub) user.id = token.sub;
      const role = (token as typeof token & { role?: "TRADER" | "VIP_SIMULATOR" | "ADMIN" }).role;
      user.role = role ?? "TRADER";
      return session;
    },
  },
});
