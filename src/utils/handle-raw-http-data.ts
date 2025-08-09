import * as net from "net";
import { parseHttpRequest, parseStartLineAndHeaders } from "../core/request-parser";
import { CHUNKED_REGEX } from "./constants";
import { getContentLength } from "./common";
import { routeRequest } from "../core/router/router";
import { buildHttpResponse } from "./response-builder";
import { createChunkedState, feedChunked, getChunkedBody } from "../core/chunked-decoder";

const CHUNKED_STATE = Symbol("chunkedState");
const SAVED_HEADER_PART = Symbol("savedHeaderPart");

type SocketWithState = net.Socket & {
    [CHUNKED_STATE]?: ChunkedState,
    [SAVED_HEADER_PART]?: Buffer;
}

function looksLikeRequestLine(buf: Buffer): boolean {
    const eol = buf.indexOf("\r\n");
    if (eol === -1) return false;
    const line = buf.toString("ascii", 0, eol);
    return /^[A-Z]+ [^\s]+ HTTP\/1\.[01]$/.test(line);
}

function handleRequest(full: Buffer, socket: net.Socket) {
    try {
        const req = parseHttpRequest(full);
        const res = routeRequest(req);
        const raw = buildHttpResponse(res);
        socket.write(raw);
        if ((req.headers as any)["connection"] === "close") socket.end();
    } catch (e) {
        console.error("Request handling error:", e);
        socket.write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        socket.end();
    }
}


export default function handleRawHttpData(bufferRef: { buffer: Buffer }, chunk: Buffer, socket: SocketWithState) {
    // Append incoming bytes
    bufferRef.buffer = Buffer.concat([bufferRef.buffer, chunk]);

    while (true) {
        // If we're in the middle of a chunked body and the buffer doesn't start with a new request line,
        // feed these bytes straight into the chunked decoder (no header parsing).
        if (socket[CHUNKED_STATE] && !looksLikeRequestLine(bufferRef.buffer)) {
            const state = socket[CHUNKED_STATE]!;
            const consumed = feedChunked(state, bufferRef.buffer);
            const doneBody = getChunkedBody(state);

            // slice consumed body bytes
            bufferRef.buffer = bufferRef.buffer.subarray(consumed);

            if (!doneBody) return; // waiting for more body data

            // body completed → stitch with saved headers
            const headerPart = socket[SAVED_HEADER_PART]!;
            socket[CHUNKED_STATE] = undefined;
            socket[SAVED_HEADER_PART] = undefined;

            const fullRequest = Buffer.concat([headerPart, doneBody]);

            handleRequest(fullRequest, socket);

            // continue to process any pipelined request already buffered
            continue;
        }

        // Need headers block to proceed to new request: find CRLFCRLF
        const headerEndIndex = bufferRef.buffer.indexOf("\r\n\r\n")
        if (headerEndIndex === -1 || !looksLikeRequestLine(bufferRef.buffer)) return;


        const headerEnd = headerEndIndex + 4;
        const headerPart = bufferRef.buffer.subarray(0, headerEnd)
        const { headers } = parseStartLineAndHeaders(headerPart)


        // Handle Expect: 100-continue
        const expect = String(headers["expect"] || "").toLowerCase();
        if (expect.includes("100-continue")) {
            socket.write("HTTP/1.1 100 Continue\r\n\r\n");
        }


        //decide body farming
        const transferEncoding = String(headers["transfer-encoding"] || "").toLowerCase();
        const isChunked = CHUNKED_REGEX.test(transferEncoding)

        if (!isChunked) {
            const contentLength = getContentLength(headers)
            const totalNeeded = headerEnd + contentLength

            if (bufferRef.buffer.length < totalNeeded) return // wait for full body
            const fullRequest = bufferRef.buffer.subarray(0, totalNeeded)
            bufferRef.buffer = bufferRef.buffer.subarray(totalNeeded); // keep-alive: slice consumed

            handleRequest(fullRequest, socket);
            continue;
        }

        if (!socket[CHUNKED_STATE]) {
            socket[CHUNKED_STATE] = createChunkedState();
            socket[SAVED_HEADER_PART] = headerPart;
        }

        const state = socket[CHUNKED_STATE]

        // Feed only the body segment after headers
        const bodySlice = bufferRef.buffer.subarray(headerEnd)
        const consumedBodyBytes = feedChunked(state, bodySlice)
        const doneBody = getChunkedBody(state);

        bufferRef.buffer = bufferRef.buffer.subarray(headerEnd + consumedBodyBytes);

        if (!doneBody) {
            // Not done—wait for more body bytes; do NOT try to parse headers again
            return;
        }

        // Completed within this iteration
        socket[CHUNKED_STATE] = undefined;
        socket[SAVED_HEADER_PART] = undefined;

        const fullRequest = Buffer.concat([headerPart, doneBody]);
        handleRequest(fullRequest, socket);
        // loop to handle any next pipelined request

    }
}

