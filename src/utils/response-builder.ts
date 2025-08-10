import { KEEP_ALIVE_MAX, KEEP_ALIVE_TIMEOUT_MS } from "./constants";

function statusText(code: number): string {
    switch (code) {
        case 200: return "OK";
        case 204: return "No Content";
        case 301: return "Moved Permanently";
        case 302: return "Found";
        case 304: return "Not Modified";
        case 400: return "Bad Request";
        case 403: return "Forbidden";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 413: return "Payload Too Large";
        case 500: return "Internal Server Error";
        default: return "OK";
    }
}

export function buildHttpResponse(res: HttpResponse, keepAlive = true): Buffer {
    const headers = { ...(res.headers || {}) }

    //Normalize body to buffer
    const bodyBuf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(String(res.body), 'utf-8')

    //Default content type only if caller didn't set one
    if (headers["Content-Type"] == null) {
        headers["Content-Type"] = "text/plain";
    }

    if (headers["Date"] == null) {
        headers["Date"] = new Date().toUTCString();
    }

    // Content-Length (avoid for 1xx and 204)
    const is1xx = res.statusCode >= 100 && res.statusCode < 200;
    if (!is1xx && res.statusCode !== 204 && headers["Content-Length"] == null) {
        headers["Content-Length"] = String(bodyBuf.length);
    }


    // Connection / Keep-Alive policy
    if (keepAlive) {
        if (headers["Connection"] == null) headers["Connection"] = "keep-alive";
        const secs = Math.max(1, Math.floor((KEEP_ALIVE_TIMEOUT_MS) / 1000));
        const max = KEEP_ALIVE_MAX;
        if (headers["Keep-Alive"] == null) {
            headers["Keep-Alive"] = `timeout=${secs}, max=${max}`;
        }
    } else {
        headers["Connection"] = "close";
    }

    // Build the raw HTTP message
    const statusLine = `HTTP/1.1 ${res.statusCode} ${statusText(res.statusCode)}\r\n`;
    const headerLines = Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");
    const head = statusLine + headerLines + "\r\n\r\n";

    return Buffer.concat([Buffer.from(head, "ascii"), bodyBuf]);
}
