import { practiceRequest, jsonBody } from "@/lib/practice/http";
import { previewOrder, placeOrder, cancelOrder } from "@/lib/practice/service";
import { PracticeError } from "@/lib/practice/domain";
export function POST(request: Request) {
  return practiceRequest(request, true, async userId => {
    const body = await jsonBody(request);
    if (body.action === "preview") return previewOrder(userId, body.order);
    if (body.action === "confirm" && body.confirmed === true) return placeOrder(userId, body.token);
    throw new PracticeError("Preview the order and explicitly confirm before submitting.");
  });
}
export function DELETE(request: Request) {
  return practiceRequest(request, true, async userId => {
    const body = await jsonBody(request);
    if (typeof body.id !== "string" || body.id.length > 64) throw new PracticeError("Invalid order ID.");
    return cancelOrder(userId, body.id);
  });
}
