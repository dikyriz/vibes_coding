import { Elysia } from "elysia";

export const errorHandler = new Elysia({ name: "error-handler" })
  .onError(({ code, set }) => {
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return { error: "Input tidak valid" };

      case "NOT_FOUND":
        set.status = 404;
        return { error: "Route tidak ditemukan" };

      default:
        set.status = 500;
        return { error: "Internal server error" };
    }
  })
  .as("global");
