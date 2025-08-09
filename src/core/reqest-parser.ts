function parseHeaders(lines: string[]): Record<string, string | string[]> {
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

export function parseStartLineAndHeaders(buffer: Buffer) {
    const raw = buffer.toString("ascii");
    const headerEnd = raw.indexOf("\r\n\r\n")

    if (headerEnd === -1) throw new Error("Headers not complete")

    const head = raw.slice(0, headerEnd)
    const lines = head.split("\r\n")

    const [method, rawPath, version] = lines[0].split(" ")
    const [path, queryString] = rawPath.split("?", 2)
    const query = parseQueryString(queryString)

    const headers = parseHeaders(lines.slice(1))

    return {
        method,
        path,
        version,
        headers, 
        query
    }
}

export function parseHttpRequest(buffer: Buffer): HttpRequest {
    const raw = buffer.toString("ascii")

    // Find header boundary using ASCII scan
    const headerEnd = indexOfCrlfCrlf(buffer);

    if (headerEnd === -1) throw new Error("No header boundry found")

    const headerEndIncl = headerEnd + 4
    const { path, method, version, headers, query } = parseStartLineAndHeaders(buffer.subarray(0, headerEndIncl))
    const body = buffer.subarray(headerEndIncl)

    return {
        method,
        path,
        version,
        headers,
        query,
        body,
        raw,
    }

}

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

function indexOfCrlfCrlf(buf: Buffer): number {
    for (let i = 0; i + 3 < buf.length; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
    }
    return -1;
}

