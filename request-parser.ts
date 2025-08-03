import { parseHeaders } from "./utils";

export function parseHttpRequest(raw: string): HttpRequest {
    const [headerPart, body = ""] = raw.split("\r\n\r\n");
    const lines = headerPart.split("\r\n");

    const [method, path, version] = lines[0].split(" ");
    const headers = parseHeaders(lines.slice(1));

    return {
        method,
        path,
        version,
        headers,
        body,
        raw,
    };
}
