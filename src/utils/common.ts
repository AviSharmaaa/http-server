import * as net from "net";

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
    const errorMsg =
        code === 413 ? "Payload Too Large" : code === 400 ? "Bad Request" : "Error";

    const headers = [
        `HTTP/1.1 ${code} ${errorMsg}`,
        "Content-Length: 0",
        keepAlive ? "Connection: keep-alive" : "Connection: close",
        "\r\n",
    ].join("\r\n");

    socket.write(headers)
    if (!keepAlive) socket.end()
}
