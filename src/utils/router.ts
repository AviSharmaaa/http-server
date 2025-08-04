export function routeRequest(req: HttpRequest): HttpResponse {
    const { method, path, query, body } = req;

    // GET example with query params
    if (method === "GET" && path === "/search") {
        return {
            statusCode: 200,
            body: `You searched for: ${JSON.stringify(query)}`,
        };
    }

    // POST example
    if (method === "POST" && path === "/echo") {
        return {
            statusCode: 200,
            body: `POST body: ${body}`,
        };
    }

    // PUT example
    if (method === "PUT" && path === "/update") {
        return {
            statusCode: 200,
            body: `Updated with: ${body}`,
        };
    }

    // DELETE example
    if (method === "DELETE" && path === "/remove") {
        return {
            statusCode: 200,
            body: `Deleted resource`,
        };
    }

    return { statusCode: 404, body: "Not Found" };
}
