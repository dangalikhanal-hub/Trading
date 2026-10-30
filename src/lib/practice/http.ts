import { auth } from "@/auth";
import { allowAuthAttempt } from "@/lib/auth-rate-limit";
import { hasTrustedOrigin } from "@/lib/request-security";
import { PracticeError } from "./domain";
export async function practiceRequest(request: Request, mutation: boolean, handler: (userId: string) => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (mutation && !hasTrustedOrigin(request)) throw new PracticeError("Invalid request origin.", 403);
    const session = await auth();
    if (!session?.user?.id) throw new PracticeError("Sign in to use the practice workspace.", 401);
    if (!(await allowAuthAttempt(`practice:${mutation ? "write" : "read"}:${session.user.id}`, mutation ? 60 : 240, 60_000))) throw new PracticeError("Too many requests. Try again in a minute.", 429);
    return Response.json(await handler(session.user.id), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof PracticeError ? error.message : "Practice service unavailable. Please retry. No real-money orders can be sent." }, { status: error instanceof PracticeError ? error.status : 503, headers });
  }
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 100_000) throw new PracticeError("Request is too large.");
  const text = await request.text();
  if (text.length > 100_000) throw new PracticeError("Request is too large.");
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new PracticeError("Invalid JSON request."); }
}
