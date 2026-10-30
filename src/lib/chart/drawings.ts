export type DrawingTool = "trend" | "horizontal" | "vertical" | "ray" | "price" | "rectangle" | "fibonacci";
export interface DrawingPoint { time: number; price: number }
export interface Drawing { id: string; tool: DrawingTool; points: DrawingPoint[] }
export function parseDrawings(value: unknown): Drawing[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = new Set<string>();
  const output: Drawing[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const v = raw as Record<string, unknown>;
    if (typeof v.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(v.id) || ids.has(v.id) || !["trend", "horizontal", "vertical", "ray", "price", "rectangle", "fibonacci"].includes(String(v.tool))) return null;
    ids.add(v.id);
    if (!Array.isArray(v.points) || v.points.length !== (["horizontal", "vertical", "price"].includes(String(v.tool)) ? 1 : 2)) return null;
    const points: DrawingPoint[] = [];
    for (const p of v.points) {
      if (!p || typeof p !== "object" || !Number.isFinite(p.time) || !Number.isFinite(p.price) || p.time < 1262304000 || p.time > 4102444800 || p.price <= 0 || p.price > 1e9) return null;
      points.push({ time: p.time, price: p.price });
    }
    output.push({ id: v.id, tool: v.tool as DrawingTool, points });
  }
  return output;
}
