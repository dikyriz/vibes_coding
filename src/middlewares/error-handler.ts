import { Elysia } from "elysia";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set }) => {
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return { message: "Validation error", details: error.message };

      case "NOT_FOUND":
        set.status = 404;
        return { message: "Route not found" };

      default:
        set.status = 500;
        return { message: "Internal server error" };
    }
  },
);
