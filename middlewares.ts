// medusa backend для логирования - /src/api/middlewares.ts
import { 
  defineMiddlewares,
  validateAndTransformBody,
  authenticate,
} from "@medusajs/framework/http";
import { logAuthMiddleware } from "./store/middleware/log-auth";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/customers/me/*",
      middlewares: [
        logAuthMiddleware,
        authenticate("customer", ["session", "bearer"]),
      ],
    },
    {
      matcher: "/store/customers/me",
      middlewares: [
        logAuthMiddleware,
        authenticate("customer", ["session", "bearer"]),
      ],
    },
