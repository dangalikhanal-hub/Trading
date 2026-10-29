-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TRADER', 'VIP_SIMULATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimeInForce" AS ENUM ('GTC', 'IOC', 'FOK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TRADER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "paper_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "initial_balance" DECIMAL(18,4) NOT NULL DEFAULT 100000.00,
    "cash_balance" DECIMAL(18,4) NOT NULL DEFAULT 100000.00,
    "reserved_margin" DECIMAL(18,4) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "leverage_limit" INTEGER NOT NULL DEFAULT 50,
    "is_simulated" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_positions" (
    "id" TEXT NOT NULL,
    "paper_account_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "PositionSide" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "entry_price" DECIMAL(18,4) NOT NULL,
    "current_price" DECIMAL(18,4) NOT NULL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "margin_used" DECIMAL(18,4) NOT NULL,
    "unrealized_pnl" DECIMAL(18,4) NOT NULL DEFAULT 0.00,
    "realized_pnl" DECIMAL(18,4) NOT NULL DEFAULT 0.00,
    "liquidation_price" DECIMAL(18,4),
    "stop_loss_price" DECIMAL(18,4),
    "take_profit_price" DECIMAL(18,4),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_orders" (
    "id" TEXT NOT NULL,
    "paper_account_id" TEXT NOT NULL,
    "client_order_id" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "time_in_force" "TimeInForce" NOT NULL DEFAULT 'GTC',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DECIMAL(18,8) NOT NULL,
    "filled_quantity" DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    "limit_price" DECIMAL(18,4),
    "stop_price" DECIMAL(18,4),
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "reduce_only" BOOLEAN NOT NULL DEFAULT false,
    "simulated_slippage" DECIMAL(6,4) NOT NULL DEFAULT 0.0005,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_trades" (
    "id" TEXT NOT NULL,
    "paper_account_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "quote_quantity" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 0.00,
    "realized_pnl" DECIMAL(18,4) NOT NULL DEFAULT 0.00,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "asset_class" TEXT NOT NULL DEFAULT 'CRYPTO',
    "symbol" TEXT NOT NULL DEFAULT 'BTC/USD',
    "timeframe" TEXT NOT NULL DEFAULT '1h',
    "parameters" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "win_rate" DECIMAL(5,2),
    "total_return" DECIMAL(8,2),
    "sharpe_ratio" DECIMAL(5,2),
    "max_drawdown" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Watchlist',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "watchlist_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL DEFAULT 'CRYPTO',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "paper_accounts_user_id_key" ON "paper_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "paper_positions_paper_account_id_symbol_side_key" ON "paper_positions"("paper_account_id", "symbol", "side");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_watchlist_id_symbol_key" ON "watchlist_items"("watchlist_id", "symbol");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_accounts" ADD CONSTRAINT "paper_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_positions" ADD CONSTRAINT "paper_positions_paper_account_id_fkey" FOREIGN KEY ("paper_account_id") REFERENCES "paper_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_paper_account_id_fkey" FOREIGN KEY ("paper_account_id") REFERENCES "paper_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_paper_account_id_fkey" FOREIGN KEY ("paper_account_id") REFERENCES "paper_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "paper_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
