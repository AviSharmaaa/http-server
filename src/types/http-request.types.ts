interface HttpRequest {
    method: string;
    path: string;
    version: string;
    headers: Record<string, string | string[]>;
    cookies?: Record<string, string>;
    query: Record<string, string>
    body: string;
    raw: string;
}
