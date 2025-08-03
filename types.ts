interface HttpRequest {
    method: string;
    path: string;
    version: string;
    headers: Record<string, string>;
    body: string;
    raw: string;
}

interface HttpResponse {
    statusCode: number;
    headers?: Record<string, string>;
    body: string;
}
