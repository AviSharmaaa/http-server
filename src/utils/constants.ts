export const CHUNKED_REGEX = /\bchunked\b/;
export const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024; //10MB

// Keep-Alive policy
export const KEEP_ALIVE_TIMEOUT_MS = 5000; // 5s idle timeout
export const KEEP_ALIVE_MAX = 100;         // max requests per TCP connection