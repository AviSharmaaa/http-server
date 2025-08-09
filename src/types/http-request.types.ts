type HeadersMap = Record<string, string | string[]>;

interface HttpRequest {
    method: string;
    path: string;
    version: string;
    headers: HeadersMap;
    cookies?: Record<string, string>;
    query: Record<string, string>
    body: Buffer | null;
    raw: string;
}
