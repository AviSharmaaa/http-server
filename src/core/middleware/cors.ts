interface CorsOptions {
  origin?: string[]; // Allowed origins, e.g. ["*"] or ["https://site.com"]
  methods?: string[]; // Allowed HTTP methods
  allowedHeaders?: string[]; // Allowed request headers
  exposedHeaders?: string[]; // Headers accessible in browser
  credentials?: boolean; // Allow cookies/auth
  maxAge?: number; // Preflight cache duration (seconds)
}

export default function cors(options: CorsOptions = {}) {
  const {
    origin = ["*"],
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["*"], // "*" means allow all request headers
    exposedHeaders = [],
    credentials = false,
    maxAge = 600,
  } = options;

  return (req: HttpRequest, next: () => HttpResponse) => {
    const requestOrigin = req.headers["origin"] as string || "";

    let allowOriginHeader = "";
    if (origin.includes("*")) {
      allowOriginHeader = "*";
    } else if (origin.includes(requestOrigin)) {
      allowOriginHeader = requestOrigin;
    } else {
      allowOriginHeader = "null";
    }

    let allowHeadersValue = "";
    if (allowedHeaders.includes("*")) {
      // If browser sent Access-Control-Request-Headers, reflect them
      const requested = req.headers["access-control-request-headers"] as string;
      if (requested) {
        allowHeadersValue = requested;
      } else {
        // Fallback to safe defaults
        allowHeadersValue = "content-type, authorization";
      }
    } else {
      allowHeadersValue = allowedHeaders.join(", ");
    }

    // Enforce: credentials + "*" is invalid
    if (credentials && allowOriginHeader === "*") {
      console.warn(
        '[CORS] "credentials: true" cannot be used with origin="*". ' +
          "Falling back to request origin if present."
      );
      allowOriginHeader = requestOrigin || "null";
    }

    // Prepare CORS headers
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": allowOriginHeader,
      "Access-Control-Allow-Methods": methods.join(", "),
      "Access-Control-Allow-Headers": allowHeadersValue,
    };

    if (exposedHeaders.length > 0) {
      corsHeaders["Access-Control-Expose-Headers"] = exposedHeaders.join(", ");
    }

    if (credentials) {
      corsHeaders["Access-Control-Allow-Credentials"] = "true";
    }

    if (maxAge) {
      corsHeaders["Access-Control-Max-Age"] = maxAge.toString();
    }

    // Preflight request handling
    if (req.method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: "",
      };
    }

    // Normal requests → merge CORS headers
    const res = next();
    res.headers = { ...(res.headers || {}), ...corsHeaders };
    return res;
  };
}
