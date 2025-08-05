import * as net from "net";
import { registerRoutes } from "../utils/routes";
import { registerMiddlewares } from "../utils/middlewares";
import handleRawHttpData from "../utils/handle-raw-http-data";

registerMiddlewares();
registerRoutes();

const server = net.createServer((socket) => {
    const bufferRef = { buffer: "" }

    socket.on("data", (chunk) => { handleRawHttpData(bufferRef, chunk, socket) });

    socket.on("error", (err) => {
        console.error("Socket error:", err);
        socket.end();
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`🟢 HTTP Server listening on http://localhost:${PORT}`);
});
