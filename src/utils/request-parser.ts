import { parseHeaders } from "./common";

function parseQueryString(path: string): Record<string, string> {
    let queryParams: Record<string, string> = {}

    const [_, queryString] = path.split("?", 2)

    if (!queryString) return queryParams;

    queryString.split("&").forEach((pair) => {
        if (!pair) return;
        const [rawKey, rawValue = ""] = pair.split("=");
        const key = decodeURIComponent(rawKey || "").trim()
        const value = decodeURIComponent(rawValue || "").trim()

        if (key) {
            queryParams[key] = value
        }

    })

    return queryParams

}

export function parseHttpRequest(raw: string): HttpRequest {
    const [headerPart, body = ""] = raw.split("\r\n\r\n");
    const lines = headerPart.split("\r\n");

    const [method, path, version] = lines[0].split(" ");
    const headers = parseHeaders(lines.slice(1));
    const query = parseQueryString(path)

    return {
        method,
        path,
        version,
        headers,
        query,
        body,
        raw,
    };
}
