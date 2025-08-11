# 🛠️ Low-Level HTTP/HTTPS Server

A **from-scratch** HTTP/HTTPS server framework in TypeScript, built using **raw TCP/TLS sockets** — no `http`, `https`, or Express. This project was created to deeply understand the internals of how an HTTP server works at the protocol level.

## 🎯 Purpose

The main goal is to understand what’s going on behind high-level frameworks by:
- Manually handling **socket connections**  
- Parsing **HTTP requests** and building **HTTP responses**
- Implementing real-world HTTP/1.1 features myself
- Seeing how middleware, routing, compression, static file serving, and security (CORS, HTTPS) actually work under the hood

## ✨ Features Implemented

- **Core Networking**
  - Raw TCP (HTTP) and TLS (HTTPS) servers
  - HTTP/1.1 parser: method, path, version, headers, query, body
  - Keep-Alive support

- **Routing & Middleware**
  - Simple `addRoute(method, path, handler)` API
  - Middleware pipeline (`use()`)
  - 404 (Not Found) and 405 (Method Not Allowed) with `Allow` header
  - Global error handler with JSON error responses

- **Request Parsing**
  - JSON, text, form body parsing
  - Chunked transfer decoding (with size limits → 413 Payload Too Large)
  - Cookie parsing (`req.cookies`)

- **Static File Serving**
  - ETag, Last-Modified, Cache-Control headers
  - 304 Not Modified support
  - MIME type detection
  - Directory traversal protection

- **Compression**
  - Gzip and Brotli compression
  - Configurable thresholds

- **Security**
  - CORS middleware with allowed origins/methods/headers
  - HTTPS dev cert auto-generation & trust (macOS, Windows auto-trust, Linux manual steps)


## ⚙️ Installation

```sh
git clone https://github.com/AviSharmaaa/http-server.git
cd http-server
npm install
npm run build
````

Start HTTP:

```sh
npm run start:http
```

Start HTTPS (auto-generates trusted dev cert):

```sh
npm run start:https
```

## 🧪 Example Route

```ts
import { addRoute } from "./router/router";

addRoute("GET", "/hello", () => ({
  statusCode: 200,
  body: "Hello from HTTPS server!"
}));
```

## 🔍 Test It

```sh
curl -v http://localhost:8080/hello
curl -vk https://localhost:8443/hello
```

## 📜 License

This project is licensed under the MIT License - see the [`LICENSE`](LICENSE) file for details.
