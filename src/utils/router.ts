type RouteHandler = (req: HttpRequest) => HttpResponse

export const routes: Record<string, Record<string, RouteHandler>> = {
    GET: {},
    POST: {},
    PUT: {},
    PATCH: {},
    DELETE: {},
}

//register/add a route
export const addRoute = (method: string, path: string, handler: RouteHandler) => {
    const methodUpper = method.toUpperCase()

    if (!routes[methodUpper]) routes[methodUpper] = {}
    routes[methodUpper][path] = handler
}

export const routeRequest = (req: HttpRequest): HttpResponse => {
    const methodRoutes = routes[req.method]
    const handler = methodRoutes[req.path]

    if (!handler) {
        return { statusCode: 404, body: "Not Found" }
    }

    return handler(req)
}