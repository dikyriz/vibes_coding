import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

import { errorHandler } from "./middlewares/error-handler";
import { usersRoute } from "./routes/users-route";

export const app = new Elysia()
  .use(
    swagger({
      path: "/docs",
      specPath: "/openapi.json",
      provider: "swagger-ui",
      exclude: ["/docs", "/openapi.json"],
      documentation: {
        info: {
          title: "Vibes Coding API",
          description:
            "Backend REST API untuk manajemen user dengan autentikasi berbasis token",
          version: "1.0.0",
        },
      },
    }),
  )
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .group("/api", (app) => app.use(usersRoute));
