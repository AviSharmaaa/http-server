export class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message?: string) {
        super(message || `HTTP ${statusCode}`);
        this.statusCode = statusCode;
        this.name = "HttpError";
    }
}
