import { use } from "./router";

export function registerMiddlewares() {
    use((req, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        return next()
    })
}