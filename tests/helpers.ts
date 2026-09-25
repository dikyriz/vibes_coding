import { count, eq } from "drizzle-orm";

import { app } from "../src/app";
import { db } from "../src/db";
import { sessions, users, type User } from "../src/db/schema";

const BASE_URL = "http://localhost";

export type ApiResponse = {
  status: number;
  body: any;
};

/**
 * Memanggil aplikasi tanpa menyalakan server HTTP, lewat handler Elysia.
 * Ini membuat test cepat dan tidak berebut port.
 */
export async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.token !== undefined) {
    headers.authorization = options.token;
  }

  const response = await app.handle(
    new Request(`${BASE_URL}${path}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

/**
 * Membersihkan data antar test supaya tiap test mulai dari keadaan kosong dan
 * urutan eksekusi tidak mempengaruhi hasilnya. `sessions` dihapus lebih dulu
 * karena punya foreign key ke `users`.
 */
export async function resetDatabase() {
  await db.delete(sessions);
  await db.delete(users);
}

/**
 * Menyiapkan user yang sudah login. Dipakai oleh test yang membutuhkan token.
 */
export async function registerAndLogin(
  overrides: { name?: string; email?: string; password?: string } = {},
) {
  const user = {
    name: overrides.name ?? "Dicky",
    email: overrides.email ?? "dicky@localhost",
    password: overrides.password ?? "rahasia",
  };

  const register = await call("POST", "/api/users", { body: user });

  if (register.status !== 201) {
    throw new Error(`Gagal registrasi: ${JSON.stringify(register)}`);
  }

  const login = await call("POST", "/api/users/login", {
    body: { email: user.email, password: user.password },
  });

  if (login.status !== 200) {
    throw new Error(`Gagal login: ${JSON.stringify(login)}`);
  }

  return { user, token: login.body.data as string };
}

export async function sessionCount() {
  const [row] = await db.select({ value: count() }).from(sessions);

  return Number(row?.value ?? 0);
}

export async function findStoredUser(email: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email));

  return row;
}
