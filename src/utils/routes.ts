import { addRoute, routes } from "./router";

export function registerRoutes() {
    addRoute("GET", "/search", (req) => ({
        statusCode: 200,
        body: `You searched for: ${JSON.stringify(req.query)}`,
    }));

    addRoute("POST", "/echo", (req) => ({
        statusCode: 200,
        body: `POST body: ${req.body}`,
    }));

    addRoute("PUT", "/update", (req) => ({
        statusCode: 200,
        body: `Updated with: ${req.body}`,
    }));

    addRoute("DELETE", "/remove", () => ({
        statusCode: 200,
        body: `Deleted resource`,
    }));

}
