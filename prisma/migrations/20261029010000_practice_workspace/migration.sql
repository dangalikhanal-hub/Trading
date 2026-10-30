ALTER TABLE "paper_accounts" ADD COLUMN "day_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "day_start_equity" DECIMAL(18,4) NOT NULL DEFAULT 100000;
ALTER TABLE "paper_orders" ADD COLUMN "reserved_notional" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "fee_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stop_loss_price" DECIMAL(18,4),
  ADD COLUMN "take_profit_price" DECIMAL(18,4),
  ADD COLUMN "triggered_at" TIMESTAMP(3),
  ADD COLUMN "filled_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "paper_trades" ADD COLUMN "entry_price" DECIMAL(18,4);
CREATE UNIQUE INDEX "paper_orders_paper_account_id_client_order_id_key" ON "paper_orders"("paper_account_id", "client_order_id");
CREATE INDEX "paper_orders_paper_account_id_status_created_at_idx" ON "paper_orders"("paper_account_id", "status", "created_at");
CREATE INDEX "paper_trades_paper_account_id_executed_at_idx" ON "paper_trades"("paper_account_id", "executed_at");
CREATE TABLE "chart_drawings" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "symbol" TEXT NOT NULL,
  "timeframe" TEXT NOT NULL, "shapes" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chart_drawings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_drawings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "chart_drawings_user_id_symbol_timeframe_key" ON "chart_drawings"("user_id", "symbol", "timeframe");
