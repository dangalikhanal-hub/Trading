import { practiceRequest, jsonBody } from "@/lib/practice/http";
import { syncPractice, resetAccount } from "@/lib/practice/service";
import { PracticeError } from "@/lib/practice/domain";
export function GET(request: Request) { return practiceRequest(request, false, syncPractice); }
export function POST(request: Request) {
  return practiceRequest(request, true, async userId => {
    const body = await jsonBody(request);
    if (body.action !== "reset" || body.confirm !== "RESET PRACTICE") throw new PracticeError("Confirm RESET PRACTICE before clearing this account.");
    return resetAccount(userId, body.balance);
  });
}
