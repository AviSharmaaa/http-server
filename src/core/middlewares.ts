import path from "path";
import { bodyParser } from "./body-parser";
import { cookieParser } from "../utils/cookie-parser";
import cors from "../utils/cors";
import { use } from "./router";
import serveStatic from "../utils/serve-static";

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
    use(serveStatic(path.join(process.cwd(), "public")));
    use(bodyParser({ limit: 1024 * 1024 }));
}
