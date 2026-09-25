import { Elysia, t } from "elysia";

import {
  EmailAlreadyRegisteredError,
  usersService,
} from "../services/users-service";

export const usersRoute = new Elysia({ prefix: "/users" }).post(
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
);
