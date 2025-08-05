import { bodyParser } from "./body-parser";
import cors from "./cors";
import { use } from "./router";

export function registerMiddlewares() {
    use(cors({
        origin: ["http://localhost:3000", "https://app.example.com"],
        credentials: true
    }));
    use((req, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        return next();
    });
    use(bodyParser({ limit: 1024 * 1024 }));
}
