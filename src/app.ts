import { Elysia } from "elysia";

import { errorHandler } from "./middlewares/error-handler";
import { usersRoute } from "./routes/users-route";

export const app = new Elysia()
  .use(errorHandler)
  .get("/health", () => ({ status: "ok" }))
  .group("/api", (app) => app.use(usersRoute));
