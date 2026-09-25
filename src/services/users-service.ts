import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { sessions, users } from "../db/schema";

const SALT_ROUNDS = 10;

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

    const token = crypto.randomUUID();

    await db.insert(sessions).values({ token, userId: user.id });

    return token;
  },
};
