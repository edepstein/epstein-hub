/**
 * CSRF protection for cookie-authenticated mutations. A state-changing request must come from
 * this site: its Origin header must equal the site origin (configured or the request's own), or,
 * when a browser omits Origin, Sec-Fetch-Site must be "same-origin". Requests carrying neither
 * are refused, so a cross-site form post or fetch cannot ride on the family session cookie.
 */
export interface OriginCheckInput {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  requestUrl: string;
  host?: string | null;
  forwardedProto?: string | null;
  allowedOrigin?: string | null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function expectedOrigins(input: Pick<OriginCheckInput, "requestUrl" | "host" | "forwardedProto" | "allowedOrigin">): string[] {
  const out = new Set<string>();
  if (input.allowedOrigin) out.add(input.allowedOrigin);
  try {
    out.add(new URL(input.requestUrl).origin);
  } catch {
    /* ignore */
  }
  if (input.host) {
    const proto = input.forwardedProto?.split(",")[0]?.trim() || new URL(input.requestUrl).protocol.replace(":", "");
    out.add(`${proto}://${input.host}`);
  }
  return [...out];
}

export function isSameOriginMutation(input: OriginCheckInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (input.origin && input.origin !== "null") {
    return expectedOrigins(input).includes(input.origin);
  }
  return input.secFetchSite === "same-origin";
}

export function checkRequestOrigin(request: Request, allowedOrigin: string | null): boolean {
  return isSameOriginMutation({
    method: request.method,
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    requestUrl: request.url,
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    allowedOrigin,
  });
}
