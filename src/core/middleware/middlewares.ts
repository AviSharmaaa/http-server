import path from "path";
import { bodyParser } from "./body-parser";
import { cookieParser } from "./cookie-parser";
import cors from "./cors";
import { use } from "../router/router";
import serveStatic from "./serve-static";
import compression from "./compression";

export function registerMiddlewares() {
    use(cors({
        origin: ["http://localhost:3000", "https://app.example.com"],
        credentials: true
    }));
    use((req, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        return next();
    });
    use(cookieParser())
    use(bodyParser({ limit: 1024 * 1024 }));
    use(compression({
        threshold: 1024,             // 1 KB
        brotli: true,
        gzip: true,
    }));
    use(serveStatic(path.join(process.cwd(), "public")));
}
