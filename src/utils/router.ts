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

export const routeRequest = (req: HttpRequest): HttpResponse => {
    const methodRoutes = routes[req.method]
    const handler = methodRoutes[req.path]

    if (!handler) {
        return { statusCode: 404, body: "Not Found" }
    }

    let index = 0;

    const run = () => {
        if (index < middlewares.length) {
            const mw = middlewares[index++]
            return mw(req, run)
        }

        return handler(req)
    }

    return run()
}