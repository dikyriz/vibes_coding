import { app } from "./app";
import { env } from "./config/env";

const listeningApp = app.listen(env.port);

console.log(
  `🦊 Server running at http://localhost:${listeningApp.server?.port}`,
);
