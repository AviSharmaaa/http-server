import { addRoute, routes } from "./router";

export function registerRoutes() {
    addRoute("GET", "/search", (req) => ({
        statusCode: 200,
        body: `You searched for: ${JSON.stringify(req.query)}`,
    }));

    addRoute("POST", "/echo", (req) => ({
        statusCode: 200,
        body: `POST body: ${JSON.stringify(req.body)}`,
    }));

    addRoute("PUT", "/update", (req) => ({
        statusCode: 200,
        body: `Updated with: ${req.body}`,
    }));

    addRoute("DELETE", "/remove", () => ({
        statusCode: 200,
        body: `Deleted resource`,
    }));

    addRoute("GET", "/hello", () => ({
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: "Hello from HTTPS server!",
    }));
}
