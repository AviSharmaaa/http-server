import { HttpError } from "../../types/error";
import { makeErrorResponse, statusText } from "../../utils/common";

export default function errorHandler(
    onError?: (err: unknown, req: HttpRequest) => void
) {
    const exposeStack = process.env.NODE_ENV !== "production";

    return (req: HttpRequest, next: () => HttpResponse): HttpResponse => {
        try {
            const res = next();

            // Normalize 404/405 only if the route didn't already decide a content type.
            if (res && (res.statusCode === 404 || res.statusCode === 405)) {
                const hasCT =
                    !!res.headers?.["Content-Type"] || !!res.headers?.["content-type"];

                if (!hasCT) {
                    const shaped = makeErrorResponse(
                        res.statusCode,
                        String(res.body ?? statusText(res.statusCode))
                    );
                    // preserve any headers already set by route (except content-type we just set)
                    shaped.headers = { ...(res.headers || {}), ...shaped.headers };
                    return shaped;
                }
            }

            return res;
        } catch (err: any) {
            console.error("[ERR]: ", { err })
            onError?.(err, req); 

            if (err instanceof HttpError) {
                return makeErrorResponse(
                    err.statusCode,
                    err.message,
                    exposeStack ? String(err.stack || "") : undefined
                );
            }

            // Fallback: unexpected error → 500
            return makeErrorResponse(
                500,
                String(err?.message || statusText(500)),
                exposeStack ? String(err?.stack || "") : undefined
            );
        }
    };
}
