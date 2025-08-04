import tls from "tls";
import fs from "fs";
import { getContentLength } from "../utils/common";
import { parseHttpRequest } from "../utils/request-parser";
import { buildHttpResponse } from "../utils/response-builder";
import { routeRequest } from "../utils/router";
import { registerRoutes } from "../utils/routes";

registerRoutes();

const options = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
};

const server = tls.createServer(options, (socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
        buffer += chunk.toString();

        if (!buffer.includes("\r\n\r\n")) return;

        const headerEndIndex = buffer.indexOf("\r\n\r\n") + 4;
        const headerPart = buffer.slice(0, headerEndIndex);
        const { headers } = parseHttpRequest(headerPart);
        const contentLength = getContentLength(headers);

        const totalLength = headerEndIndex + contentLength;
        if (buffer.length < totalLength) return;

        const fullRequest = buffer.slice(0, totalLength);
        buffer = buffer.slice(totalLength); // keep-alive

        const req = parseHttpRequest(fullRequest);
        const res = routeRequest(req);
        const rawResponse = buildHttpResponse(res);

        socket.write(rawResponse);

        if (req.headers["connection"] === "close") {
            socket.end();
        }
    });

    socket.on("error", (err) => {
        console.error("TLS Socket error:", err);
        socket.end();
    });
});

const HTTPS_PORT = 8443;
server.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running at https://localhost:${HTTPS_PORT}`);
});
