import { Elysia, t } from "elysia";

import { usersService } from "./users.service";

export const usersRoute = new Elysia({ prefix: "/users" })
  .get("/", () => usersService.list())
  .get(
    "/:id",
    async ({ params, status }) => {
      const user = await usersService.getById(Number(params.id));
      if (!user) return status(404, { message: "User not found" });
      return user;
    },
    { params: t.Object({ id: t.Numeric() }) },
  )
  .post(
    "/",
    async ({ body, status }) => {
      const user = await usersService.create(body);
      return status(201, user);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        email: t.String({ format: "email" }),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, status }) => {
      const user = await usersService.update(Number(params.id), body);
      if (!user) return status(404, { message: "User not found" });
      return user;
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Partial(
        t.Object({
          name: t.String({ minLength: 1 }),
          email: t.String({ format: "email" }),
        }),
      ),
    },
  )
  .delete(
    "/:id",
    async ({ params, status }) => {
      await usersService.remove(Number(params.id));
      return status(204);
    },
    { params: t.Object({ id: t.Numeric() }) },
  );
