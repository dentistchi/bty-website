/**
 * Structured error logging for API routes (500/4xx).
 * Keeps existing console.error behavior; optional single pattern for route + status.
 */

export function logApiError(
  route: string,
  status: number,
  messageOrError: string | unknown
): void {
  const msg = typeof messageOrError === "string" ? messageOrError : messageOrError instanceof Error ? messageOrError.message : String(messageOrError);
  console.error(`[${route}] ${status}`, msg);
  if (messageOrError instanceof Error && messageOrError.stack) {
    console.error(messageOrError.stack);
  }
}
