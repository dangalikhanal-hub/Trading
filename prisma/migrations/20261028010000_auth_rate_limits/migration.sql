CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_rate_limits_resetAt_idx" ON "auth_rate_limits"("resetAt");
