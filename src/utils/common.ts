

export function getContentLength(headers: Record<string, string | string[]>): number {
    return parseInt(headers["content-length"] as string || "0", 10);
}
