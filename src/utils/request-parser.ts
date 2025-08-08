import { parseHeaders } from "./common";

function parseQueryString(queryString: string): Record<string, string> {
    let queryParams: Record<string, string> = {}

    if (!queryString) return queryParams;

    queryString.split("&").forEach((pair) => {
        if (!pair) return;
        const [rawKey, rawValue = ""] = pair.split("=");
        const key = decodeURIComponent(rawKey.replace(/\+/g, " ")).trim()
        const value = decodeURIComponent(rawValue.replace(/\+/g, " ")).trim()

        if (key) {
            queryParams[key] = value
        }

    })

    return queryParams

}

export function parseHttpRequest(raw: string): HttpRequest {
    const [headerPart, body = ""] = raw.split("\r\n\r\n");
    const lines = headerPart.split("\r\n");

    const [method, rawPath, version] = lines[0].split(" ");

    const [path, queryString] = rawPath.split("?", 2)
    const query = parseQueryString(queryString)

    const headers = parseHeaders(lines.slice(1));

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
