/** Cookie-authenticated mutations must come from the configured application. */
export function hasTrustedOrigin(request: Request) {
  try {
    const expected = new URL(process.env.AUTH_URL || request.url).origin;
    return request.headers.get("origin") === expected;
  } catch {
    return false;
  }
}
