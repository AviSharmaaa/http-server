import fs from "fs";
import path from "path";
import mime from "mime-types";
import crypto from "crypto";

export default function serveStatic(rootDir: string) {
    return (req: HttpRequest, next: () => HttpResponse): HttpResponse => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        const safePath = path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(rootDir, safePath);

        if (!filePath.startsWith(path.resolve(rootDir))) {
            return { statusCode: 403, body: "Forbidden" };
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            return next();
        }

        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath);
        const contentType = mime.lookup(filePath) || "application/octet-stream";

        const lastModified = stat.mtime.toUTCString();
        const etag = crypto.createHash("md5").update(content).digest("hex");

        if (
            req.headers["if-none-match"] === etag ||
            new Date(req.headers["if-modified-since"] as string || "") >= stat.mtime
        ) {
            return {
                statusCode: 304,
                headers: {
                    "ETag": etag,
                    "Last-Modified": lastModified,
                    "Cache-Control": "public, max-age=86400, must-revalidate",
                },
                body: "",
            };
        }

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Content-Length": content.length.toString(),
            "Cache-Control": "public, max-age=86400, must-revalidate",
            "ETag": etag,
            "Last-Modified": lastModified,
        };

        return {
            statusCode: 200,
            headers,
            body: req.method === "HEAD" ? "" : content,
        };
    };
}
