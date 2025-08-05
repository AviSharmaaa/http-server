import tls from "tls";
import fs from "fs";
import { registerRoutes } from "../utils/routes";
import { registerMiddlewares } from "../utils/middlewares";
import handleRawHttpData from "../utils/handle-raw-http-data";

registerMiddlewares();
registerRoutes();

const options = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
};

const server = tls.createServer(options, (socket) => {
    let bufferRef = { buffer: "" }

    socket.on("data", (chunk) => { handleRawHttpData(bufferRef, chunk, socket) });

    socket.on("error", (err) => {
        console.error("TLS Socket error:", err);
        socket.end();
    });
});

const HTTPS_PORT = 8443;
server.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running at https://localhost:${HTTPS_PORT}`);
});
