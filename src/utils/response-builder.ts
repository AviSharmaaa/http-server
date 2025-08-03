export function buildHttpResponse(res: HttpResponse): string {
    const statusText = {
        200: "OK",
        404: "Not Found",
        500: "Internal Server Error",
    }[res.statusCode] || "Unknown";

    const headers = {
        "Content-Length": Buffer.byteLength(res.body),
        "Content-Type": "text/plain",
        "Connection": "keep-alive",
        ...res.headers,
    };

    const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);

    return [
        `HTTP/1.1 ${res.statusCode} ${statusText}`,
        ...headerLines,
        "",
        res.body,
    ].join("\r\n");
}
