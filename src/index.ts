import { Elysia } from "elysia";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { usersRoute } from "./routes/users-route";

const app = new Elysia()
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .group("/api", (app) => app.use(usersRoute))
  .listen(env.port);

console.log(`🦊 Server running at http://localhost:${app.server?.port}`);
