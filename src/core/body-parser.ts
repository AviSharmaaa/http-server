interface BodyParserOptions {
    limit?: number
}

export function bodyParser(options: BodyParserOptions = {}) {
    const maxSize = options.limit || 1024 * 1024 //1 MB

    return (req: HttpRequest, next: () => HttpResponse) => {
        const contentType = req.headers["content-type"] as string
        const contentLength = parseInt(req.headers["content-length"] as string || "0", 10)

        if (contentLength > maxSize) {
            return {
                statusCode: 413,
                body: "Payload Too Large",
            }
        }

        req.body = parseBody(contentType, req.body)
        return next()
    }
}

function parseBody(contentType: string, body: Buffer |null) {
    const rawBody = body?.toString('ascii')
    if (!rawBody) return "";

    const mime = contentType.split(";")[0].trim().toLowerCase()

    try {
        if (mime === "application/json") return JSON.parse(rawBody)

        if (mime === "application/x-www-form-urlencoded") {
            const body: Record<string, any> = {}

            rawBody.split("&").forEach((pair) => {
                if (!pair) return;

                const [k, v = ""] = pair.split("=")
                const key = k.replace(/\+/g, " ")
                const value = v.replace(/\+/g, " ")
                body[decodeURIComponent(key)] = decodeURIComponent(value)
            })
            return body

        }

        return rawBody

    } catch (error) {
        console.log("Error parsing request body: ", error)
        return rawBody
    }

}