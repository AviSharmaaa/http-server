import zlib from "zlib"

type Encoding = "gzip" | "br" | "identity"

interface CompressionOptions {
    threshold?: number;                 // min bytes before compressing (default 1024)
    brotli?: boolean;                   // enable br (default true)
    gzip?: boolean;                     // enable gzip (default true)
    mimeInclude?: RegExp;               // which content-types to compress
    mimeExclude?: RegExp;               // exclude these (wins over include)
}

const DEFAULT_OPTS: Required<CompressionOptions> = {
    threshold: 1024,
    brotli: true,
    gzip: true,
    mimeInclude: /^(text\/|application\/(json|javascript|xml|wasm))/i,
    mimeExclude: /^(image\/|audio\/|video\/|application\/pdf)/i,
};

function pickEncoding(accept: string, opts: Required<CompressionOptions>): Encoding {
    const a = accept.toLowerCase();
    // very naive q handling — good enough for now
    const brOk = opts.brotli && /\bbr\b/.test(a);
    const gzipOk = opts.gzip && /\bgzip\b/.test(a);
    if (brOk) return "br";
    if (gzipOk) return "gzip";
    return "identity";
}

function shouldCompress(res: HttpResponse, opts: Required<CompressionOptions>): boolean {
    // no body statuses
    if (res.statusCode < 200 || res.statusCode === 204 || res.statusCode === 304) return false;

    // if user already set Content-Encoding, do not recompress
    const enc = res.headers?.["Content-Encoding"] || res.headers?.["content-encoding"];
    if (enc) return false;

    // content-type checks
    const contentType = (res.headers?.["Content-Type"] || res.headers?.["content-type"] || "").toString();
    if (!contentType) return false;
    if (opts.mimeExclude.test(contentType)) return false;
    if (!opts.mimeInclude.test(contentType)) return false;

    // size threshold: only compress sufficiently large payloads
    const len = Buffer.isBuffer(res.body)
        ? res.body.length
        : Buffer.byteLength(String(res.body ?? ""));
    return len >= opts.threshold;
}

export default function compression(userOpts: CompressionOptions = {}) {
    const opts = { ...DEFAULT_OPTS, ...userOpts };

    return (req: HttpRequest, next: () => HttpResponse): HttpResponse => {
        const res = next();

        // Always set Vary for caches when we might vary by encoding
        res.headers = { ...(res.headers || {}) };
        const prevVary = res.headers["Vary"];
        res.headers["Vary"] = prevVary ? `${prevVary}, Accept-Encoding` : "Accept-Encoding";

        if (!shouldCompress(res, opts)) return res;

        const accept = String(req.headers["accept-encoding"] || "");
        const encoding = pickEncoding(accept, opts);
        if (encoding === "identity") return res;

        const input = Buffer.isBuffer(res.body)
            ? res.body
            : Buffer.from(String(res.body ?? ""), "utf8");

        let out: Buffer;
        try {
            if (encoding === "br") {
                out = zlib.brotliCompressSync(input, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 5, // balanced
                    } as any,
                });
            } else {
                out = zlib.gzipSync(input, { level: zlib.constants.Z_BEST_SPEED });
            }
        } catch {
            // If compression fails for any reason, fall back to identity
            return res;
        }

        res.headers["Content-Encoding"] = encoding;
        // For compressed payloads, set the new length
        res.headers["Content-Length"] = String(out.length);

        // Keep Content-Type as-is; do not touch ETag/Last-Modified here
        res.body = out;
        return res;
    };
}