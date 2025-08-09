export function cookieParser() {
    return (req: HttpRequest, next: () => HttpResponse) => {
        const cookieHeader = req.headers["cookie"] as string
        const cookies: Record<string, string> = {}

        if (!cookieHeader) return next()

        cookieHeader.split(";").forEach((pair) => {
            if (!pair) return

            const [key, value = ""] = pair.trim().split("=")
            if (key) {
                cookies[decodeURIComponent(key)] = decodeURIComponent(value)
            }
        })

        req.cookies = cookies

        return next()
    }
}