import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "../config/env";
import * as schema from "./schema";

const pool = mysql.createPool(env.databaseUrl);

export const db = drizzle(pool, { schema, mode: "default" });
