export function parseHeaders(lines: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of lines) {
        const [key, ...rest] = line.split(": ");
        headers[key.toLowerCase()] = rest.join(": ").trim();
    }
    return headers;
}

export function getContentLength(headers: Record<string, string>): number {
    return parseInt(headers["content-length"] || "0", 10);
}
