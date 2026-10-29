export type WatchlistAction =
  | { action: "create"; name: string }
  | { action: "delete"; watchlistId: string }
  | { action: "add"; watchlistId: string; symbol: string; assetType: string }
  | { action: "remove"; watchlistId: string; symbol: string };

export function parseWatchlistAction(input: unknown): WatchlistAction | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (value.action === "create") {
    const name = typeof value.name === "string" ? value.name.trim() : "";
    return name.length > 0 && name.length <= 60 && !/[\x00-\x1f\x7f]/.test(name)
      ? { action: "create", name } : null;
  }
  const watchlistId = typeof value.watchlistId === "string" ? value.watchlistId : "";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(watchlistId)) return null;
  if (value.action === "delete") return { action: "delete", watchlistId };
  const symbol = typeof value.symbol === "string" ? value.symbol.trim().toUpperCase() : "";
  // Storage syntax only; provider availability is not implied by accepting a symbol.
  if (!/^[A-Z0-9^][A-Z0-9.^/_-]{0,31}$/.test(symbol)) return null;
  if (value.action === "remove") return { action: "remove", watchlistId, symbol };
  if (value.action === "add" && typeof value.assetType === "string" &&
      ["CRYPTO", "EQUITY", "FOREX", "INDEX"].includes(value.assetType)) {
    return { action: "add", watchlistId, symbol, assetType: value.assetType };
  }
  return null;
}
