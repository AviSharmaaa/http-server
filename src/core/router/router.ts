type RouteHandler = (req: HttpRequest) => HttpResponse
type Middleware = (req: HttpRequest, next: () => HttpResponse) => HttpResponse

export const routes: Record<string, Record<string, RouteHandler>> = {
    GET: {},
    POST: {},
    PUT: {},
    PATCH: {},
    DELETE: {},
}

export const middlewares: Middleware[] = []

/**
 * Register a new route handler
 */
export const addRoute = (method: string, path: string, handler: RouteHandler) => {
    const methodUpper = method.toUpperCase()

    if (!routes[methodUpper]) routes[methodUpper] = {}
    routes[methodUpper][path] = handler
}

/**
 * Register a middleware
 */
export const use = (middleware: Middleware) => {
    middlewares.push(middleware)
}

function allowedMethodsFor(path: string): string[] {
    const allowedMethods: string[] = []

    for (let method in routes) {
        if (routes[method][path]) {
            allowedMethods.push(method)
        }
    }

    // If GET exists, HEAD is implicitly allowed (even if not registered)
    if (allowedMethods.includes("GET") && !allowedMethods.includes("HEAD")) {
        allowedMethods.push("HEAD")
    }

    // OPTIONS is allowed for any existing resource
    if (!allowedMethods.includes("OPTIONS") && allowedMethods.length > 0) {
        allowedMethods.push("OPTIONS")
    }

    return allowedMethods;
}

export const routeRequest = (req: HttpRequest): HttpResponse => {
    const methodUpper = req.method.toUpperCase();
    let handler = routes[methodUpper]?.[req.path]

    if(!handler && methodUpper === "HEAD") {
        handler = routes["GET"]?.[req.path]
    }

    // OPTIONS fallback: if no explicit handler but the path exists for some other method, reply 204 + Allow
    if (!handler && methodUpper === "OPTIONS") {
        const allow = allowedMethodsFor(req.path);
        if (allow.length > 0) {
            handler = () => ({
                statusCode: 204,
                headers: { "Allow": allow.join(", ") },
                body: "", // no body for 204
            });
        }
    }

    // 405 vs 404 decision
    if (!handler) {
        const allow = allowedMethodsFor(req.path);
        if (allow.length > 0) {
            handler = () => ({
                statusCode: 405,
                headers: { "Allow": allow.join(", ") },
                body: "Method Not Allowed",
            });
        } else {
            handler = () => ({
                statusCode: 404,
                body: "Not Found",
            });
        }
    }

    let index = 0;

    const run = (): HttpResponse => {
        if (index < middlewares.length) {
            const mw = middlewares[index++];
            return mw(req, run);
        }
        return handler(req);
    };

    return run();
};
