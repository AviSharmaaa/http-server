import * as net from "net";
import { buildHttpResponse } from "./response-builder";

export function getContentLength(
    headers: Record<string, string | string[]>
): number {
    return parseInt((headers["content-length"] as string) || "0", 10);
}

export function looksLikeRequestLine(buf: Buffer): boolean {
    const eol = buf.indexOf("\r\n");
    if (eol === -1) return false;
    const line = buf.toString("ascii", 0, eol);
    return /^[A-Z]+ [^\s]+ HTTP\/1\.[01]$/.test(line);
}


export function writeErrorAndMaybeClose(
    socket: net.Socket,
    code: number,
    keepAlive: boolean
) {
    // Shape the error exactly like app/middleware errors
    const res = makeErrorResponse(
        code,
        code === 413 ? "Payload Too Large via transport" : undefined
    );

    const raw = buildHttpResponse(res, keepAlive);
    socket.write(raw);
    if (!keepAlive) socket.end();
}


export function statusText(code: number): string {
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

export function makeErrorResponse(
    code: number,
    message?: string,
    stack?: string
): HttpResponse {
    const body = JSON.stringify({
        message: String(message ?? statusText(code)),
        ...(stack ? { stack } : {}),
    });

    return {
        statusCode: code,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
    };
}