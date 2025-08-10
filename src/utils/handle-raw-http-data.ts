import * as net from "net";
import {
    parseHttpRequest,
    parseStartLineAndHeaders,
} from "../core/request-parser";
import { CHUNKED_REGEX, DEFAULT_MAX_BODY_BYTES, KEEP_ALIVE_MAX } from "./constants";
import { getContentLength, looksLikeRequestLine, writeErrorAndMaybeClose } from "./common";
import { routeRequest } from "../core/router/router";
import { buildHttpResponse } from "./response-builder";
import {
    createChunkedState,
    feedChunked,
    getChunkedBody,
} from "../core/chunked-decoder";
import { nextReqCount } from "./conn-state";

const CHUNKED_STATE = Symbol("chunkedState");
const SAVED_HEADER_PART = Symbol("savedHeaderPart");

type SocketWithState = net.Socket & {
    [CHUNKED_STATE]?: ChunkedState;
    [SAVED_HEADER_PART]?: Buffer;
};

function handleRequest(full: Buffer, socket: net.Socket) {
    try {
        const req = parseHttpRequest(full);
        let res = routeRequest(req);

        // HEAD => no body, but keep Content-Length
        if (req.method === "HEAD") {
            const len = Buffer.isBuffer(res.body) ? res.body.length : Buffer.byteLength(String(res.body ?? ""));
            res = { ...res, headers: { ...(res.headers || {}), "Content-Length": String(len) }, body: Buffer.alloc(0) };
        }

        const count = nextReqCount(socket);
        const clientWantsClose = String((req.headers as any)["connection"] || "").toLowerCase() === "close";
        const underMax = count < KEEP_ALIVE_MAX;
        const keep = !clientWantsClose && underMax;

        const raw = buildHttpResponse(res, keep);
        socket.write(raw);
        if (!keep) socket.end();
    } catch (e) {
        console.error("Request handling error:", e);
        writeErrorAndMaybeClose(socket, 400, false)
    }
}

export default function handleRawHttpData(
    bufferRef: { buffer: Buffer },
    chunk: Buffer,
    socket: SocketWithState,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES
) {
    // Append incoming bytes
    bufferRef.buffer = Buffer.concat([bufferRef.buffer, chunk]);

    while (true) {
        // If we're in the middle of a chunked body and the buffer doesn't start with a new request line,
        // feed these bytes straight into the chunked decoder (no header parsing).
        if (socket[CHUNKED_STATE] && !looksLikeRequestLine(bufferRef.buffer)) {
            const state = socket[CHUNKED_STATE]!;
            let consumed = 0
            try {
                consumed = feedChunked(state, bufferRef.buffer, maxBodyBytes);
            } catch (error: any) {
                bufferRef.buffer = bufferRef.buffer.subarray(consumed);
                const code = /too large/i.test(error.message) ? 413 : 400;
                socket[CHUNKED_STATE] = undefined
                socket[SAVED_HEADER_PART] = undefined;
                writeErrorAndMaybeClose(socket, code, false)
                return;
            }

            const doneBody = getChunkedBody(state);
            // slice consumed body bytes
            bufferRef.buffer = bufferRef.buffer.subarray(consumed);

            if (!doneBody) return; // waiting for more body data

            // body completed → stitch with saved headers
            const headerPart = socket[SAVED_HEADER_PART]!;
            socket[CHUNKED_STATE] = undefined;
            socket[SAVED_HEADER_PART] = undefined;

            const { method, path, version, headers } = parseStartLineAndHeaders(headerPart);
            delete (headers as any)["transfer-encoding"];
            (headers as any)["content-length"] = String(doneBody.length);

            const firstLine = `${method} ${path} ${version}\r\n`;
            const headerLines = Object.entries(headers)
                .map(([k, v]) =>
                    Array.isArray(v)
                        ? v.map((x) => `${k}: ${x}`).join("\r\n")
                        : `${k}: ${v}`
                )
                .join("\r\n");
            const rebuiltHeader = Buffer.from(firstLine + headerLines + "\r\n\r\n", "ascii");

            const fullRequest = Buffer.concat([rebuiltHeader, doneBody]);

            handleRequest(fullRequest, socket);

            // continue to process any pipelined request already buffered
            continue;
        }

        // Need headers block to proceed to new request: find CRLFCRLF
        const headerEndIndex = bufferRef.buffer.indexOf("\r\n\r\n");
        if (headerEndIndex === -1 || !looksLikeRequestLine(bufferRef.buffer))
            return;

        const headerEnd = headerEndIndex + 4;
        const headerPart = bufferRef.buffer.subarray(0, headerEnd);
        const { headers } = parseStartLineAndHeaders(headerPart);

        //decide body farming
        const transferEncoding = String(headers["transfer-encoding"] || "").toLowerCase();
        const isChunked = CHUNKED_REGEX.test(transferEncoding);
        const expect = String(headers["expect"] || "").toLowerCase();

        if (!isChunked) {
            const contentLength = getContentLength(headers);
            if (contentLength > maxBodyBytes) {
                writeErrorAndMaybeClose(socket, 413, false);
                bufferRef.buffer = bufferRef.buffer.subarray(headerEnd);
                return;
            }

            // If Expect: 100-continue, we’re ok to proceed
            if (expect.includes("100-continue")) {
                socket.write("HTTP/1.1 100 Continue\r\n\r\n");
            }

            const totalNeeded = headerEnd + contentLength;

            if (bufferRef.buffer.length < totalNeeded) return; // wait for full body
            const fullRequest = bufferRef.buffer.subarray(0, totalNeeded);
            bufferRef.buffer = bufferRef.buffer.subarray(totalNeeded); // keep-alive: slice consumed

            handleRequest(fullRequest, socket);
            continue;
        }

        if (!socket[CHUNKED_STATE]) {
            socket[CHUNKED_STATE] = createChunkedState();
            socket[SAVED_HEADER_PART] = headerPart;
        }

        const state = socket[CHUNKED_STATE];

        // Feed only the body segment after headers
        const bodySlice = bufferRef.buffer.subarray(headerEnd);
        let consumedBodyBytes = 0
        try {
            consumedBodyBytes = feedChunked(state, bodySlice, maxBodyBytes);
        } catch (error: any) {
            // On error, drop headers + consumed body bytes from the buffer
            bufferRef.buffer = bufferRef.buffer.subarray(headerEnd + consumedBodyBytes);
            const code = /too large/i.test(String(error?.message)) ? 413 : 400;
            socket[CHUNKED_STATE] = undefined;
            socket[SAVED_HEADER_PART] = undefined;
            writeErrorAndMaybeClose(socket, code, false);
            return;
        }

        const doneBody = getChunkedBody(state);
        bufferRef.buffer = bufferRef.buffer.subarray(headerEnd + consumedBodyBytes);

        if (!doneBody) {
            // Not done—wait for more body bytes; do NOT try to parse headers again
            return;
        }

        // Completed within this iteration
        socket[CHUNKED_STATE] = undefined;
        socket[SAVED_HEADER_PART] = undefined;

        const { method, path, version, headers: hdrs } = parseStartLineAndHeaders(headerPart);
        delete (hdrs as any)["transfer-encoding"];
        (hdrs as any)["content-length"] = String(doneBody.length);

        const firstLine = `${method} ${path} ${version}\r\n`;
        const headerLines = Object.entries(hdrs)
            .map(([k, v]) =>
                Array.isArray(v) ? v.map((x) => `${k}: ${x}`).join("\r\n") : `${k}: ${v}`
            )
            .join("\r\n");
        const rebuiltHeader = Buffer.from(firstLine + headerLines + "\r\n\r\n", "ascii");

        const fullRequest = Buffer.concat([rebuiltHeader, doneBody]);
        handleRequest(fullRequest, socket);
        // loop to handle any next pipelined request
    }
}
