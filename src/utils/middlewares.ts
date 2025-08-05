import { bodyParser } from "./body-parser";
import { use } from "./router";

export function registerMiddlewares() {
    use((req, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        return next()
    })
    use(bodyParser({ limit: 1024 * 1024 }))
}