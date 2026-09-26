import bcrypt from "bcryptjs";
import { and, eq, gt, lte } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const SALT_ROUNDS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Error yang dilempar saat registrasi gagal karena email sudah terdaftar.
 * Digunakan oleh route untuk mengembalikan status 409.
 */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email sudah terdaftar");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Error yang dilempar saat login gagal karena email atau password salah.
 * Pesan error identik untuk kedua kasus agar attacker tidak bisa menebak email mana yang terdaftar.
 * Digunakan oleh route untuk mengembalikan status 401.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email atau password salah");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Error yang dilempar saat token tidak valid atau tidak ditemukan.
 * Termasuk: token kosong, token tidak dikenal, token sudah di-logout, atau token kedaluwarsa.
 * Digunakan oleh route untuk mengembalikan status 401.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export const usersService = {
  /**
   * Mengecek apakah email sudah terdaftar di database.
   * Dipakai sebelum registrasi untuk mencegah duplikasi email.
   * Hanya mengambil kolom `id` karena hanya butuh keberadaan (boolean).
   *
   * @param email - Email yang akan dicek
   * @returns `true` jika email sudah ada, `false` jika belum
   */
  async isEmailRegistered(email: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    return Boolean(user);
  },

  /**
   * Mendaftarkan user baru ke database.
   *
   * Alur:
   * 1. Cek apakah email sudah terdaftar → lempar `EmailAlreadyRegisteredError` jika ya
   * 2. Hash password menggunakan bcrypt dengan `SALT_ROUNDS`
   * 3. Insert user baru ke tabel `users`
   *
   * Password TIDAK dikembalikan ke caller (service hanya menyimpan).
   *
   * @param data - Objek berisi `name`, `email`, dan `password` (plaintext)
   * @throws {EmailAlreadyRegisteredError} jika email sudah ada
   */
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

  /**
   * Memverifikasi kredensial login dan membuat sesi baru.
   *
   * Alur:
   * 1. Cari user berdasarkan email
   * 2. Verifikasi password dengan `bcrypt.compare` terhadap hash yang tersimpan
   * 3. Hapus sesi yang sudah kedaluwarsa (lazy cleanup)
   * 4. Generate token UUID baru
   * 5. Simpan sesi baru dengan `expiresAt` = sekarang + TTL
   *
   * Kembalikan token ke route agar bisa dikirim ke client.
   *
   * @param data - Objek berisi `email` dan `password` (plaintext)
   * @returns Token UUID string yang bisa dipakai di header `Authorization`
   * @throws {InvalidCredentialsError} jika email tidak ditemukan atau password salah
   */
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

  /**
   * Mengambil data user berdasarkan token sesi.
   *
   * Alur:
   * 1. Validasi token tidak kosong
   * 2. Cari session aktif (token cocok DAN belum kedaluwarsa)
   * 3. Ambil user dari `user_id` pada session tersebut
   * 4. Kembalikan object user tanpa field `password`
   *
   * Field `created_at` ditransformasi ke string ISO agar konsisten dengan response schema.
   *
   * @param token - Token dari header `Authorization: Bearer <token>`
   * @returns Object user dengan field `{ id, name, email, created_at }`
   * @throws {UnauthorizedError} jika token kosong, tidak ditemukan, atau sudah kedaluwarsa
   */
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

  /**
   * Mengakhiri sesi (logout) dengan menghapus token dari database.
   *
   * Alur:
   * 1. Validasi token tidak kosong
   * 2. Hapus baris sesi WHERE `token` cocok DAN belum kedaluwarsa
   * 3. Jika tidak ada baris yang terhapus (`affectedRows === 0`), lempar error
   *
   * Pendekatan delete langsung (bukan check-then-delete) menjaga atomisitas:
   * dua request logout paralel dengan token sama hanya akan berhasil satu.
   *
   * Sesi yang sudah kedaluwarsa tidak dihapus di sini — akan dibersihkan
   * saat login berikutnya (lazy cleanup).
   *
   * @param token - Token dari header `Authorization: Bearer <token>`
   * @throws {UnauthorizedError} jika token kosong, tidak ditemukan, atau sudah kedaluwarsa
   */
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
