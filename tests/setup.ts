import mysql from "mysql2/promise";

/**
 * Database terpisah untuk test, supaya `bun test` tidak pernah menghapus atau
 * mengubah data development. Nama database bisa dioverride lewat TEST_DATABASE.
 */
export const TEST_DATABASE = process.env.TEST_DATABASE ?? "vibes_coding_test";

const configuredUrl = process.env.DATABASE_URL;

if (!configuredUrl) {
  throw new Error(
    "DATABASE_URL tidak ter-set. Salin .env.example menjadi .env lalu jalankan ulang `bun test`.",
  );
}

const databaseUrl = new URL(configuredUrl);
databaseUrl.pathname = `/${TEST_DATABASE}`;

/**
 * Di-set sebelum modul aplikasi di-import, karena src/config/env.ts membaca
 * variabel ini saat module load.
 */
process.env.DATABASE_URL = databaseUrl.toString();

const connection = await mysql.createConnection({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
});

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE}\``);

await connection.end();
