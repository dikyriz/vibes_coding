import bcrypt from "bcryptjs";
import { and, eq, gt, lte } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const SALT_ROUNDS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email sudah terdaftar");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email atau password salah");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export const usersService = {
  async isEmailRegistered(email: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    return Boolean(user);
  },

  async register(data: { name: string; email: string; password: string }) {
    if (await this.isEmailRegistered(data.email)) {
      throw new EmailAlreadyRegisteredError();
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    await db.insert(users).values({
      name: data.name,
      email: data.email,
      password: hashedPassword,
    });
  },

  async login(data: { email: string; password: string }) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email));

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new InvalidCredentialsError();
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.sessionTtlDays * MS_PER_DAY);

    // Lazy cleanup pengganti cron: sesi kedaluwarsa dibersihkan saat login.
    await db.delete(sessions).where(lte(sessions.expiresAt, now));

    const token = crypto.randomUUID();

    await db.insert(sessions).values({ token, userId: user.id, expiresAt });

    return token;
  },

  async getCurrentUser(token: string) {
    if (!token) {
      throw new UnauthorizedError();
    }

    const [session] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
      );

    if (!session) {
      throw new UnauthorizedError();
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        created_at: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user) {
      throw new UnauthorizedError();
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at.toISOString(),
    };
  },

  async logout(token: string) {
    if (!token) {
      throw new UnauthorizedError();
    }

    // Hapus langsung lalu periksa affectedRows: dua logout paralel dengan
    // token sama kini atomis — hanya satu yang menghapus baris dan dapat 200.
    // Syarat expires_at membuat sesi kedaluwarsa balas 401; barisnya ikut
    // terhapus oleh lazy cleanup saat login berikutnya.
    const [result] = await db
      .delete(sessions)
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
      );

    if (result.affectedRows === 0) {
      throw new UnauthorizedError();
    }
  },
};
