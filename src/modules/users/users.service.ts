import { eq } from "drizzle-orm";

import { db } from "../../db";
import { users, type NewUser } from "../../db/schema";

export const usersService = {
  async list() {
    return db.select().from(users);
  },

  async getById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async create(data: NewUser) {
    const [created] = await db.insert(users).values(data).$returningId();
    return this.getById(created.id);
  },

  async update(id: number, data: Partial<NewUser>) {
    await db.update(users).set(data).where(eq(users.id, id));
    return this.getById(id);
  },

  async remove(id: number) {
    await db.delete(users).where(eq(users.id, id));
  },
};
