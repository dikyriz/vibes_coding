import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { migrate } from "drizzle-orm/mysql2/migrator";

import { db } from "../src/db";
import { sessions, users } from "../src/db/schema";
import {
  call,
  findStoredUser,
  registerAndLogin,
  resetDatabase,
  sessionCount,
} from "./helpers";
import { TEST_DATABASE } from "./setup";

const EMAIL = "dicky@localhost";
const PASSWORD = "rahasia";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(async () => {
  await resetDatabase();
});

describe("isolasi database test", () => {
  test("test tidak pernah menyentuh database development", () => {
    expect(TEST_DATABASE).not.toBe("vibes_coding");
    expect(process.env.DATABASE_URL).toContain(`/${TEST_DATABASE}`);
  });
});

describe("POST /api/users", () => {
  test("registrasi berhasil dan menyimpan password sebagai hash bcrypt", async () => {
    const response = await call("POST", "/api/users", {
      body: { name: "Dicky", email: EMAIL, password: PASSWORD },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: "OK" });

    const stored = await findStoredUser(EMAIL);

    expect(stored).toBeDefined();
    expect(stored?.name).toBe("Dicky");
    expect(stored?.password).not.toBe(PASSWORD);
    expect(stored?.password).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test("menolak email yang sudah terdaftar", async () => {
    await registerAndLogin({ email: EMAIL });

    const response = await call("POST", "/api/users", {
      body: { name: "Dicky Dua", email: EMAIL, password: "yang-lain" },
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Email sudah terdaftar" });
  });

  test("menolak body yang tidak lengkap", async () => {
    const response = await call("POST", "/api/users", {
      body: { name: "Dicky" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Input tidak valid" });
  });

  test("menolak name melebihi 255 karakter", async () => {
    const longName = Array(300).fill("A").join("");
    const response = await call("POST", "/api/users", {
      body: { name: longName, email: "test@max.com", password: "rahasia" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Input tidak valid" });
  });

  test("menolak email melebihi 255 karakter", async () => {
    const longEmail = `${Array(250).fill("a").join("")}@localhost`;
    const response = await call("POST", "/api/users", {
      body: { name: "Dicky", email: longEmail, password: "rahasia" },
    });

    expect(longEmail.length).toBeGreaterThan(255);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Input tidak valid" });
  });

  test("menolak password kosong", async () => {
    const response = await call("POST", "/api/users", {
      body: { name: "Dicky", email: EMAIL, password: "" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Input tidak valid" });
  });
});

describe("POST /api/users/login", () => {
  test("menghasilkan token UUID dan satu baris sesi", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(await sessionCount()).toBe(1);
  });

  test("email salah dan password salah memberi respons yang identik", async () => {
    await registerAndLogin({ email: EMAIL });

    const wrongPassword = await call("POST", "/api/users/login", {
      body: { email: EMAIL, password: "salah" },
    });
    const unknownEmail = await call("POST", "/api/users/login", {
      body: { email: "tidak-ada@localhost", password: PASSWORD },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual({ error: "Email atau password salah" });
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  test("login berkali-kali menghasilkan sesi terpisah", async () => {
    await call("POST", "/api/users", {
      body: { name: "Dicky", email: EMAIL, password: PASSWORD },
    });

    const login = () =>
      call("POST", "/api/users/login", {
        body: { email: EMAIL, password: PASSWORD },
      });

    const first = await login();
    const second = await login();

    expect(first.body.data).not.toBe(second.body.data);
    expect(await sessionCount()).toBe(2);
  });

  test("menolak body login yang tidak lengkap", async () => {
    await registerAndLogin({ email: EMAIL });

    const withoutPassword = await call("POST", "/api/users/login", {
      body: { email: EMAIL },
    });
    const emptyBody = await call("POST", "/api/users/login");

    expect(withoutPassword.status).toBe(400);
    expect(withoutPassword.body).toEqual({ error: "Input tidak valid" });
    expect(emptyBody.status).toBe(400);
  });
});

describe("GET /api/users/current", () => {
  test("mengembalikan data user tanpa password, memakai key created_at", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const response = await call("GET", "/api/users/current", {
      token: `Bearer ${token}`,
    });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual([
      "created_at",
      "email",
      "id",
      "name",
    ]);
    expect(response.body.data.email).toBe(EMAIL);
  });

  test("menghasilkan 401 saat token tidak dikenal", async () => {
    await registerAndLogin({ email: EMAIL });

    const response = await call("GET", "/api/users/current", {
      token: "Bearer token-palsu",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("menghasilkan 401 saat header Authorization tidak dikirim", async () => {
    const response = await call("GET", "/api/users/current");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("menghasilkan 401 saat header tanpa awalan Bearer", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const response = await call("GET", "/api/users/current", { token });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("menghasilkan 401 saat token sudah di-logout", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const logout = await call("DELETE", "/api/users/logout", {
      token: `Bearer ${token}`,
    });
    expect(logout.status).toBe(200);

    const response = await call("GET", "/api/users/current", {
      token: `Bearer ${token}`,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });
});

describe("DELETE /api/users/logout", () => {
  test("menghapus sesi milik token tersebut", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    expect(await sessionCount()).toBe(1);

    const response = await call("DELETE", "/api/users/logout", {
      token: `Bearer ${token}`,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: "OK" });
    expect(await sessionCount()).toBe(0);
  });

  test("tidak menghapus sesi lain milik user yang sama", async () => {
    await call("POST", "/api/users", {
      body: { name: "Dicky", email: EMAIL, password: PASSWORD },
    });

    const login = () =>
      call("POST", "/api/users/login", {
        body: { email: EMAIL, password: PASSWORD },
      });

    const first = await login();
    const second = await login();

    const logout = await call("DELETE", "/api/users/logout", {
      token: `Bearer ${first.body.data}`,
    });

    expect(logout.status).toBe(200);
    expect(await sessionCount()).toBe(1);

    const stale = await call("GET", "/api/users/current", {
      token: `Bearer ${first.body.data}`,
    });
    const alive = await call("GET", "/api/users/current", {
      token: `Bearer ${second.body.data}`,
    });

    expect(stale.status).toBe(401);
    expect(alive.status).toBe(200);
  });

  test("logout kedua kali dengan token yang sama menghasilkan 401", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const headers = { token: `Bearer ${token}` };

    expect((await call("DELETE", "/api/users/logout", headers)).status).toBe(
      200,
    );

    const second = await call("DELETE", "/api/users/logout", headers);

    expect(second.status).toBe(401);
    expect(second.body).toEqual({ error: "Unauthorized" });
  });

  test("token tidak valid tidak menghapus data apa pun", async () => {
    await registerAndLogin({ email: EMAIL });

    const response = await call("DELETE", "/api/users/logout", {
      token: "Bearer token-palsu",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(await sessionCount()).toBe(1);
  });

  test("user tetap utuh setelah logout", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    await call("DELETE", "/api/users/logout", { token: `Bearer ${token}` });

    const stored = await findStoredUser(EMAIL);

    expect(stored).toBeDefined();
    expect(stored?.email).toBe(EMAIL);
  });

  test("hanya satu dari dua logout paralel yang berhasil", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const responses = await Promise.all([
      call("DELETE", "/api/users/logout", { token: `Bearer ${token}` }),
      call("DELETE", "/api/users/logout", { token: `Bearer ${token}` }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await sessionCount()).toBe(0);
  });

  test("menghasilkan 401 saat header Authorization tidak dikirim", async () => {
    await registerAndLogin({ email: EMAIL });

    const response = await call("DELETE", "/api/users/logout");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(await sessionCount()).toBe(1);
  });

  test("menghasilkan 401 saat format header salah", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const withoutScheme = await call("DELETE", "/api/users/logout", {
      token,
    });
    const wrongScheme = await call("DELETE", "/api/users/logout", {
      token: `Token ${token}`,
    });
    const emptyToken = await call("DELETE", "/api/users/logout", {
      token: "Bearer ",
    });

    for (const response of [withoutScheme, wrongScheme, emptyToken]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    }

    // Tidak ada sesi yang terhapus oleh request yang gagal.
    expect(await sessionCount()).toBe(1);
  });
});

describe("skema Authorization", () => {
  test("diterima dalam huruf besar maupun kecil", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const lower = await call("GET", "/api/users/current", {
      token: `bearer ${token}`,
    });
    expect(lower.status).toBe(200);

    const mixed = await call("DELETE", "/api/users/logout", {
      token: `BeArEr ${token}`,
    });
    expect(mixed.status).toBe(200);
    expect(await sessionCount()).toBe(0);
  });
});

describe("masa kedaluwarsa sesi", () => {
  async function registerUser() {
    await call("POST", "/api/users", {
      body: { name: "Dicky", email: EMAIL, password: PASSWORD },
    });

    const stored = await findStoredUser(EMAIL);

    if (!stored) {
      throw new Error("user tidak ditemukan setelah registrasi");
    }

    return stored;
  }

  test("sesi kedaluwarsa ditolak saat membaca user saat ini", async () => {
    const stored = await registerUser();

    await db.insert(sessions).values({
      token: "expired-current",
      userId: stored.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await call("GET", "/api/users/current", {
      token: "Bearer expired-current",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("sesi kedaluwarsa ditolak saat logout", async () => {
    const stored = await registerUser();

    await db.insert(sessions).values({
      token: "expired-logout",
      userId: stored.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await call("DELETE", "/api/users/logout", {
      token: "Bearer expired-logout",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("login membersihkan sesi yang sudah kedaluwarsa", async () => {
    const stored = await registerUser();

    await db.insert(sessions).values({
      token: "expired-purge",
      userId: stored.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await sessionCount()).toBe(1);

    await call("POST", "/api/users/login", {
      body: { email: EMAIL, password: PASSWORD },
    });

    // expired terhapus, sesi baru bertambah -> tetap 1
    expect(await sessionCount()).toBe(1);
  });

  test("sesi baru diberi expires_at sesuai TTL default 7 hari", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });

    const [row] = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.token, token));

    const ttlMs = row.expiresAt.getTime() - Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // MySQL membulatkan timestamp ke detik, beri toleransi 2 detik.
    expect(ttlMs).toBeGreaterThan(sevenDaysMs - 60_000);
    expect(ttlMs).toBeLessThanOrEqual(sevenDaysMs + 2000);
  });

  test("TTL sesi mengikuti env SESSION_TTL_DAYS", () => {
    // Dibaca lewat proses terpisah karena src/config/env.ts membaca env saat
    // module load, sehingga tidak bisa diubah di proses test yang sudah jalan.
    const readSessionTtlDays = (value?: string) => {
      const env = { ...process.env } as Record<string, string>;

      if (value === undefined) {
        delete env.SESSION_TTL_DAYS;
      } else {
        env.SESSION_TTL_DAYS = value;
      }

      const result = Bun.spawnSync({
        cmd: [
          "bun",
          "-e",
          "(async () => { const { env } = await import('./src/config/env'); console.log(env.sessionTtlDays); })()",
        ],
        cwd: `${import.meta.dir}/..`,
        env,
      });

      return result.stdout.toString().trim();
    };

    expect(readSessionTtlDays("3")).toBe("3");
    expect(readSessionTtlDays("30")).toBe("30");
    expect(readSessionTtlDays()).toBe("7");
  });
});

/**
 * Menjalankan query lewat koneksi MySQL terpisah.
 *
 * - Sengaja tidak memakai connection pool aplikasi: INSERT yang melanggar
 *   constraint lewat pool (mysql2 di Bun) bisa membuat janji query tidak
 *   pernah selesai dan menggantungkan test.
 * - Ada guard: koneksi menolak dipakai kalau targetnya bukan database test.
 * - `destroy()` (bukan `end()`) supaya koneksi langsung diputus.
 */
async function withRawConnection<T>(
  run: (connection: mysql.Connection) => Promise<T>,
): Promise<T> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const database = decodeURIComponent(url.pathname.slice(1));

  if (database !== TEST_DATABASE) {
    throw new Error(
      `Menolak query ke database non-test: "${database}" (harus "${TEST_DATABASE}")`,
    );
  }

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectTimeout: 5000,
  });

  try {
    return await run(connection);
  } finally {
    connection.destroy();
  }
}

async function queryMetadata(sqlText: string) {
  return withRawConnection(async (connection) => {
    const [rows] = await connection.query(sqlText);
    return rows as Record<string, unknown>[];
  });
}

/** Mengembalikan error kalau query gagal, atau `null` kalau ternyata berhasil. */
async function runQueryExpectingFailure(
  sqlText: string,
  params: unknown[],
): Promise<Error | null> {
  return withRawConnection(async (connection) => {
    try {
      await connection.query(sqlText, params);
      return null;
    } catch (error) {
      return error as Error;
    }
  });
}

describe("constraint tabel sessions", () => {
  test("kolom token memiliki constraint UNIQUE", async () => {
    const indexes = await queryMetadata(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS " +
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' " +
        "AND COLUMN_NAME = 'token' AND NON_UNIQUE = 0",
    );

    expect(indexes.map((row) => row.INDEX_NAME)).toContain(
      "sessions_token_unique",
    );
  });

  test("user_id memiliki foreign key ke users.id", async () => {
    const foreignKeys = await queryMetadata(
      "SELECT REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE " +
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' " +
        "AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users'",
    );

    expect(foreignKeys.map((row) => row.REFERENCED_COLUMN_NAME)).toEqual([
      "id",
    ]);
  });

  test("menghapus user ikut menghapus sesi miliknya (cascade)", async () => {
    await registerAndLogin({ email: EMAIL });
    const stored = await findStoredUser(EMAIL);

    expect(await sessionCount()).toBe(1);

    await db.delete(users).where(eq(users.id, stored!.id));

    expect(await sessionCount()).toBe(0);
  });

  test("insert token duplikat gagal", async () => {
    const { token } = await registerAndLogin({ email: EMAIL });
    const stored = await findStoredUser(EMAIL);

    const error = await runQueryExpectingFailure(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, NOW())",
      [token, stored!.id],
    );

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/duplicate/i);
    expect(await sessionCount()).toBe(1);
  });

  test("insert user_id yang tidak ada gagal (foreign key)", async () => {
    const error = await runQueryExpectingFailure(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, NOW())",
      [crypto.randomUUID(), 999_999],
    );

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/foreign key/i);
  });
});
