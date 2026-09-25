import { Elysia, t } from "elysia";

import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UnauthorizedError,
  usersService,
} from "../services/users-service";

const BEARER_PREFIX = "Bearer ";

export const usersRoute = new Elysia({ prefix: "/users" })
  .post(
    "/",
    async ({ body, status }) => {
      try {
        await usersService.register(body);
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          return status(409, { error: error.message });
        }

        throw error;
      }

      return status(201, { data: "OK" });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  .post(
    "/login",
    async ({ body, status }) => {
      try {
        const token = await usersService.login(body);
        return status(200, { data: token });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return status(401, { error: error.message });
        }

        throw error;
      }
    },
    {
      body: t.Object({
        email: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  .get("/current", async ({ headers, status }) => {
    const authorization = headers.authorization ?? "";
    const token = authorization.startsWith(BEARER_PREFIX)
      ? authorization.slice(BEARER_PREFIX.length)
      : "";

    try {
      const user = await usersService.getCurrentUser(token);
      return status(200, { data: user });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return status(401, { error: error.message });
      }

      throw error;
    }
  });
