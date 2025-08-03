export function routeRequest(req: HttpRequest): HttpResponse {
    if (req.method === "GET" && req.path === "/") {
        return { statusCode: 200, body: "Hello from raw HTTP server!" };
    }

    if (req.method === "POST" && req.path === "/echo") {
        return { statusCode: 200, body: `You sent: ${req.body}` };
    }

    return { statusCode: 404, body: "Not Found" };
}
