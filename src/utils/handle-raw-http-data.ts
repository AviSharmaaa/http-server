import * as net from "net";
import { parseHttpRequest } from "./request-parser";
import { getContentLength } from "./common";
import { buildHttpResponse } from "./response-builder";
import { routeRequest } from "./router";

export default function handleRawHttpData(bufferRef: { buffer: string }, chunk: Buffer, socket: net.Socket) {
    bufferRef.buffer += chunk.toString();

    // check if we have full headers
    if (!bufferRef.buffer.includes("\r\n\r\n")) return;

    const headerEndIndex = bufferRef.buffer.indexOf("\r\n\r\n") + 4;
    const headerPart = bufferRef.buffer.slice(0, headerEndIndex);
    const { headers } = parseHttpRequest(headerPart);
    const contentLength = getContentLength(headers);

    const totalLength = headerEndIndex + contentLength;
    if (bufferRef.buffer.length < totalLength) return;

    const fullRequest = bufferRef.buffer.slice(0, totalLength);
    bufferRef.buffer = bufferRef.buffer.slice(totalLength); // for keep-alive

    const req = parseHttpRequest(fullRequest);
    const res = routeRequest(req);
    const rawResponse = buildHttpResponse(res);

    socket.write(rawResponse);

    if (req.headers["connection"] === "close") {
        socket.end();
    }
}