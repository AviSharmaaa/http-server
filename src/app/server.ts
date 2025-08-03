import * as net from "net";
import { getContentLength } from "../utils/common";
import { parseHttpRequest } from "../utils/request-parser";
import { buildHttpResponse } from "../utils/response-builder";
import { routeRequest } from "../utils/router";

const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
        buffer += chunk.toString();

        // check if we have full headers
        if (!buffer.includes("\r\n\r\n")) return;

        const headerEndIndex = buffer.indexOf("\r\n\r\n") + 4;
        const headerPart = buffer.slice(0, headerEndIndex);
        const { headers } = parseHttpRequest(headerPart);
        const contentLength = getContentLength(headers);

        const totalLength = headerEndIndex + contentLength;
        if (buffer.length < totalLength) return;

        const fullRequest = buffer.slice(0, totalLength);
        buffer = buffer.slice(totalLength); // for keep-alive

        const req = parseHttpRequest(fullRequest);
        const res = routeRequest(req);
        const rawResponse = buildHttpResponse(res);

        socket.write(rawResponse);

        if (req.headers["connection"] === "close") {
            socket.end();
        }
    });

    socket.on("error", (err) => {
        console.error("Socket error:", err);
        socket.end();
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`🟢 HTTP Server listening on http://localhost:${PORT}`);
});
