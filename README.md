# vibes_coding

Backend REST API untuk manajemen user dengan autentikasi berbasis token (sessions).
Dibangun menggunakan stack modern yang cepat dan ringan.

## Tech Stack

| Lapisan       | Teknologi                                                           |
| ------------- | ------------------------------------------------------------------- |
| **Runtime**   | [Bun](https://bun.sh) — JavaScript runtime + package manager        |
| **Framework** | [ElysiaJS](https://elysiajs.com) — framework HTTP TypeScript-native |
| **ORM**       | [Drizzle ORM](https://orm.drizzle.team) — query builder & migrasi   |
| **Database**  | [MySQL](https://www.mysql.com)                                      |
| **Hashing**   | `bcryptjs` — hash password (pure JS, tanpa native build)            |
| **Testing**   | `bun test` — test runner bawaan Bun                                 |

## Arsitektur

Aplikasi mengikuti pola **separation of concerns** dengan tiga lapisan utama:

```
┌─────────────────────────────────────────┐
│  Routes (src/routes/)                   │
│  - Menerima HTTP request                │
│  - Validasi input                       │
│  - Memanggil service, kembalikan response
│  - Tidak menyentuh database langsung    │
└─────────────────┬───────────────────────┘
                  │ memanggil
┌─────────────────▼───────────────────────┐
│  Services (src/services/)               │
│  - Logic bisnis aplikasi                │
│  - Validasi data                        │
│  - Operasi database                     │
│  - Mengembalikan data ke route          │
└─────────────────┬───────────────────────┘
                  │ menggunakan
┌─────────────────▼───────────────────────┐
│  Database (src/db/)                     │
│  - Koneksi pool (mysql2)                │
│  - Schema definition (Drizzle)          │
│  - Migrasi (drizzle-kit)                │
└─────────────────────────────────────────┘
```

### Lapisan Routes (`src/routes/`)

Berisi definisi endpoint API menggunakan ElysiaJS. Setiap route hanya:

- Membaca request (body, headers, params)
- Memvalidasi input
- Memanggil service
- Mengembalikan response dengan status code yang sesuai

**Konvensi penamaan:** `{nama-fitur}-route.ts`

- Contoh: `users-route.ts` untuk semua endpoint users

### Lapisan Services (`src/services/`)

Berisi logic bisnis yang bisa dipakai ulang. Setiap service:

- Mengakses database lewat Drizzle
- Menangani validasi bisnis (cek duplikat, hash password, dll)
- Melempar error domain-specific (`EmailAlreadyRegisteredError`, dll)

**Konvensi penamaan:** `{nama-fitur}-service.ts`

- Contoh: `users-service.ts` untuk semua operasi user

### Lapisan Konfigurasi (`src/config/`)

Berisi pengaturan aplikasi dari environment variables.

### Lapisan Database (`src/db/`)

- `index.ts` — koneksi pool MySQL
- `schema.ts` — definisi tabel Drizzle

### Middleware (`src/middlewares/`)

Menangani error global dan logic yang dipakai bersama banyak route.

## Struktur Folder

```
vibes_coding/
├── src/
│   ├── app.ts              # Asumsi aplikasi Elysia (di-import index.ts)
│   ├── index.ts            # Entry point — menjalankan server
│   ├── config/
│   │   └── env.ts          # Environment variables
│   ├── db/
│   │   ├── index.ts        # Koneksi database
│   │   └── schema.ts       # Definisi tabel
│   ├── middlewares/
│   │   └── error-handler.ts # Error handler global
│   ├── routes/
│   │   └── users-route.ts  # Endpoint users (register, login, current, logout)
│   └── services/
│       └── users-service.ts # Logic bisnis users
├── drizzle/                # File migrasi database
├── tests/                  # Test suite
│   ├── setup.ts            # Preload test database
│   ├── helpers.ts          # Helper fungsi test
│   └── users.test.ts       # Test semua endpoint users
├── .env.example            # Template environment
├── bunfig.toml             # Konfigurasi Bun (preload test)
├── drizzle.config.ts       # Konfigurasi Drizzle Kit
├── package.json
└── tsconfig.json
```

## Skema Database

### Tabel `users`

| Kolom        | Tipe         | Konstrain                   | Keterangan           |
| ------------ | ------------ | --------------------------- | -------------------- |
| `id`         | Integer      | PRIMARY KEY, AUTO_INCREMENT | ID unik user         |
| `name`       | varchar(255) | NOT NULL                    | Nama lengkap user    |
| `email`      | varchar(255) | NOT NULL, UNIQUE            | Email unik           |
| `password`   | varchar(255) | NOT NULL                    | Hash bcrypt password |
| `created_at` | timestamp    | NOT NULL, DEFAULT now()     | Waktu dibuat         |

### Tabel `sessions`

| Kolom        | Tipe         | Konstrain                                   | Keterangan             |
| ------------ | ------------ | ------------------------------------------- | ---------------------- |
| `id`         | Integer      | PRIMARY KEY, AUTO_INCREMENT                 | ID sesi                |
| `token`      | varchar(255) | NOT NULL, UNIQUE                            | Token UUID sesi        |
| `user_id`    | Integer      | NOT NULL, FK → `users.id` ON DELETE CASCADE | Penghubung ke user     |
| `created_at` | timestamp    | NOT NULL, DEFAULT now()                     | Waktu sesi dibuat      |
| `expires_at` | timestamp    | NOT NULL, DEFAULT now()                     | Waktu kedaluwarsa sesi |

## API yang Tersedia

Semua endpoint tersusun di bawah path `/api/users` kecuali health check.

| Method   | Path                 | Deskripsi                | Auth Required |
| -------- | -------------------- | ------------------------ | ------------- |
| `GET`    | `/health`            | Health check             | Tidak         |
| `POST`   | `/api/users`         | Registrasi user baru     | Tidak         |
| `POST`   | `/api/users/login`   | Login → dapat token UUID | Tidak         |
| `GET`    | `/api/users/current` | Ambil data user saat ini | Ya (Bearer)   |
| `DELETE` | `/api/users/logout`  | Logout → hapus sesi      | Ya (Bearer)   |

### Response Format

**Sukses:**

```json
{ "data": "..." }
```

**Error:**

```json
{ "error": "..." }
```

Status code utama:

- `200` — sukses
- `201` — dibuat (registrasi)
- `400` — input tidak valid
- `401` — tidak sah (token salah/tidak dikirim)
- `409` — konflik (email sudah terdaftar)

### Contoh Request

**Registrasi:**

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dicky","email":"dicky@localhost","password":"rahasia"}'
```

**Login:**

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dicky@localhost","password":"rahasia"}'
```

**Ambil user saat ini:**

```bash
curl http://localhost:3000/api/users/current \
  -H "Authorization: Bearer <token>"
```

**Logout:**

```bash
curl -X DELETE http://localhost:3000/api/users/logout \
  -H "Authorization: Bearer <token>"
```

## Setup Project

### Prasyarat

- [Bun](https://bun.sh) (v1.x)
- MySQL server yang bisa diakses
- Git

### Langkah Setup

1. Install dependency:

   ```bash
   bun install
   ```

2. Salin file environment dan sesuaikan kredensial database:

   ```bash
   cp .env.example .env
   ```

   Variabel yang tersedia:

   | Variabel           | Keterangan                                                                   |
   | ------------------ | ---------------------------------------------------------------------------- |
   | `PORT`             | Port server (default `3000`)                                                 |
   | `DATABASE_URL`     | Connection string MySQL (default `mysql://root@localhost:3306/vibes_coding`) |
   | `SESSION_TTL_DAYS` | Masa berlaku token sesi dalam hari (default `7`)                             |

3. Buat database jika belum ada:

   ```sql
   CREATE DATABASE IF NOT EXISTS vibes_coding;
   ```

4. Buat tabel di database (pilih salah satu):

   ```bash
   bun run db:push      # sinkronkan schema langsung ke database
   # atau
   bun run db:generate  # generate file migrasi
   bun run db:migrate   # jalankan migrasi
   ```

## Menjalankan Aplikasi

```bash
bun run dev    # development dengan auto-reload
bun run start  # production
```

Server berjalan di `http://localhost:3000`.

## Menjalankan Test

```bash
bun run test
```

Test berjalan di database terpisah `vibes_coding_test` yang dibuat otomatis oleh `tests/setup.ts`. Data development tidak pernah tersentuh.

Nama database test bisa dioverride lewat variabel `TEST_DATABASE`.

## Script Database

| Script                | Fungsi                                  |
| --------------------- | --------------------------------------- |
| `bun run db:generate` | Generate file migrasi dari schema       |
| `bun run db:migrate`  | Jalankan migrasi ke database            |
| `bun run db:push`     | Push schema langsung tanpa file migrasi |
| `bun run db:studio`   | Buka Drizzle Studio                     |

## Catatan Perilaku Sesi

- Sesi login kedaluwarsa otomatis setelah `SESSION_TTL_DAYS` hari (default 7);
  token kedaluwarsa membalas `401 Unauthorized`.
- Baris sesi yang sudah kedaluwarsa dibersihkan secara lazy saat login
  berikutnya (tanpa cron).
- `sessions.user_id` memakai FK `ON DELETE CASCADE`: menghapus user ikut
  menghapus seluruh sesinya.
- Bentuk response setiap endpoint dideklarasikan lewat schema Elysia,
  sehingga field wajib (mis. tidak ada `password` di `/current`) terjamin.
- Header `Authorization` bersifat case-insensitive pada skema (`bearer`,
  `Bearer`, `BeArEr` semuanya diterima).
