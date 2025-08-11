interface CorsOptions {
  origin?: string[]; // Allowed origins, e.g. ["*"] or ["https://site.com"]
  methods?: string[]; // Allowed HTTP methods
  allowedHeaders?: string[]; // Allowed request headers
  credentials?: boolean; // Allow cookies/auth
  maxAge?: number; // Preflight cache duration (seconds)
}

export default function cors(options: CorsOptions = {}) {
  const {
    origin = ["*"],
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["*"], // "*" means allow all request headers
    credentials = false,
    maxAge = 600,
  } = options;

  const isOriginAllowed = (reqOrigin: string) =>
    origin.includes("*") || origin.includes(reqOrigin);

  return (req: HttpRequest, next: () => HttpResponse): HttpResponse => {
    const reqOrigin = String(req.headers["origin"] || "");
    const hasOrigin = !!reqOrigin;

    // If no Origin header, it's not a CORS request: just pass through.
    if (!hasOrigin) return next();

    // Resolve Access-Control-Allow-Origin
    let allowOrigin = "*";
    if (!origin.includes("*")) {
      allowOrigin = isOriginAllowed(reqOrigin) ? reqOrigin : "null";
    }

    // credentials + "*" is invalid → fallback to the request origin (or "null")
    if (credentials && allowOrigin === "*") {
      allowOrigin = reqOrigin || "null";
    }

    if (req.method === "OPTIONS") {
      let allowHeadersValue = "";
      if (allowedHeaders.includes("*")) {
        // reflect what browser asked for (if any), else use a safe default
        const requested = String(
          req.headers["access-control-request-headers"] || ""
        ).toLowerCase();
        allowHeadersValue = requested || "content-type, authorization";
      } else {
        allowHeadersValue = allowedHeaders.join(", ");
      }

      // Build preflight headers (only what matters for preflight)
      const preflightHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": methods.join(", "),
        "Access-Control-Allow-Headers": allowHeadersValue,
      };

      if (credentials) {
        preflightHeaders["Access-Control-Allow-Credentials"] = "true";
      }
      if (maxAge) {
        preflightHeaders["Access-Control-Max-Age"] = String(maxAge);
      }

      return {
        statusCode: 204,
        headers: preflightHeaders,
        body: "", // no body on preflight
      };
    }

    const res = next();

    // Only include the essentials on actual responses
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": allowOrigin,
      Vary: "Origin",
    };

    if (credentials) {
      corsHeaders["Access-Control-Allow-Credentials"] = "true";
    }

    res.headers = { ...(res.headers || {}), ...corsHeaders };
    return res;
  };
}
