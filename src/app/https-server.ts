import tls from "tls";
import fs from "fs";
import { registerRoutes } from "../core/routes";
import { registerMiddlewares } from "../core/middlewares";
import handleRawHttpData from "../utils/handle-raw-http-data";

registerMiddlewares();
registerRoutes();

const options = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
};

const server = tls.createServer(options, (socket) => {
    let bufferRef = { buffer: Buffer.alloc(0) as Buffer }

    socket.on("data", (chunk) => {
        try {
            handleRawHttpData(bufferRef, chunk, socket);
        } catch (err) {
            console.error("HTTPS handler error:", err);
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
