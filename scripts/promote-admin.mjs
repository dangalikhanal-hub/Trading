import { randomBytes, scrypt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const [emailArg, password, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run admin:promote -- admin@example.com "a-strong-password" "Admin Name"');
  process.exit(1);
}

const prisma = new PrismaClient();

function derive(secret, salt) {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, 64, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

async function hashPassword(secret) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(secret, salt);
  return `scrypt-v1:${salt}:${key.toString("hex")}`;
}

try {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`Promoted ${email} to ADMIN.`);
  } else if (!password || password.length < 12 || password.length > 128) {
    console.error("User not found. Provide a password of 12–128 characters to create the first admin.");
    console.error('Usage: npm run admin:promote -- admin@example.com "a-strong-password" "Admin Name"');
    process.exitCode = 1;
  } else {
    const name = nameParts.join(" ").trim() || "Super Admin";
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        wallets: {
          create: [
            { currency: "NPR", balance: "1000000" },
            { currency: "USDT", balance: "10000" },
          ],
        },
      },
    });
    console.log(`Created ${email} as ADMIN.`);
  }
} catch {
  console.error("Could not promote or create the admin user.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
