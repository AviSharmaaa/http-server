
interface HttpResponse {
    statusCode: number;
    headers?: Record<string, string>;
    body: string;
}
