import * as net from "net";
import { parseHttpRequest, parseStartLineAndHeaders } from "../core/reqest-parser";
import { CHUNKED_REGEX } from "./constants";
import { getContentLength } from "./common";
import { routeRequest } from "../core/router";
import { buildHttpResponse } from "./response-builder";
import { createChunkedState, feedChunked, getChunkedBody } from "../core/chunked-decoder";

const CHUNKED_STATE = Symbol("chunkedState")

type SocketWithState = net.Socket & { [CHUNKED_STATE]?: ChunkedState }

export default function handleRawHttpData(bufferRef: { buffer: Buffer }, chunk: Buffer, socket: SocketWithState) {
    // Append incoming bytes
    bufferRef.buffer = Buffer.concat([bufferRef.buffer, chunk]);

    while (true) {
        // Need headers first: find CRLFCRLF
        const headerEndIndex = bufferRef.buffer.indexOf("\r\n\r\n")
        if (headerEndIndex === -1) return //not enough yet

        const headerEnd = headerEndIndex + 4;
        const headerPart = bufferRef.buffer.subarray(0, headerEnd)
        const { headers } = parseStartLineAndHeaders(headerPart)

        //decide body farming
        const transferEncoding = String(headers["transfer-encoding"] || "").toLowerCase();
        const isChunked = CHUNKED_REGEX.test(transferEncoding)

        if (!isChunked) {
            const contentLength = getContentLength(headers)
            const totalNeeded = headerEnd + contentLength

            if (bufferRef.buffer.length < totalNeeded) return // wait for full body
            const fullRequest = bufferRef.buffer.subarray(0, totalNeeded)
            bufferRef.buffer = bufferRef.buffer.subarray(totalNeeded); // keep-alive: slice consumed

            const req = parseHttpRequest(fullRequest)
            const res = routeRequest(req)
            const rawResponse = buildHttpResponse(res)
            socket.write(rawResponse)

            if (req.headers["connection"] === "close") {
                socket.end();
                return;
            }

            // loop to see if another request is already buffered
            continue;
        }

        //chunked path
        if (!socket[CHUNKED_STATE]) {
            socket[CHUNKED_STATE] = createChunkedState();
        }

        const state = socket[CHUNKED_STATE]

        // Feed only the body segment after headers
        const bodySlice = bufferRef.buffer.subarray(headerEnd)
        const consumedBodyBytes = feedChunked(state, bodySlice)

        const maybeBody = getChunkedBody(state);
        if (!maybeBody) {
            // advance by the bytes we consumed from *this* body so far
            bufferRef.buffer = bufferRef.buffer.subarray(headerEnd + consumedBodyBytes);
            return;
        }

        // We have a complete chunked body
        const completedBody = maybeBody

        // Build a "full request" Buffer for the existing parser (headers + body)
        const fullRequest = Buffer.concat([headerPart, completedBody])

        // Advance the buffer: headers + the consumed body bytes used by the decoder
        bufferRef.buffer = bufferRef.buffer.subarray(headerEnd + consumedBodyBytes)

        // Reset decoder for next request on this socket
        socket[CHUNKED_STATE] = undefined;

        const req = parseHttpRequest(fullRequest);
        const res = routeRequest(req);
        const rawResponse = buildHttpResponse(res);
        socket.write(rawResponse);

        if (req.headers["connection"] === "close") {
            socket.end();
            return;
        }

        // loop for next pipelined request, if any
    }
}

