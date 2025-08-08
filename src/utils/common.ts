export function parseHeaders(lines: string[]): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};

    lines.forEach((line) => {
        const [rawKey, ...rest] = line.split(":");
        if (!rawKey || rest.length === 0) return;

        const key = rawKey.toLowerCase().trim()
        const value = rest.join(":").trim();

        if (key === "set-cookie") {
            if (!Array.isArray(headers[key])) {
                headers[key] = []
            }
            headers[key].push(value)
        } else if (headers[key]) {
            headers[key] = `${headers[key]}, ${value}`
        } else {
            headers[key] = value
        }
    })

    return headers;
}

export function getContentLength(headers: Record<string, string | string[]>): number {
    return parseInt(headers["content-length"] as string || "0", 10);
}
