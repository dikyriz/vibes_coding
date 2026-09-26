# vibes_coding

Backend REST API dengan **Bun + ElysiaJS + Drizzle ORM + MySQL**.

## Prasyarat

- [Bun](https://bun.sh) terpasang
- MySQL server yang bisa diakses

## Setup

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

## Menjalankan

```bash
bun run dev    # development dengan auto-reload
bun run start  # production
```

Server berjalan di `http://localhost:3000`.

## Menjalankan Test

```bash
bun run test
```

Test memakai database MySQL terpisah bernama `vibes_coding_test` — dibuat
otomatis oleh `tests/setup.ts` (didaftarkan lewat `bunfig.toml` sebagai preload)
sehingga data development tidak pernah tersentuh. Koneksi yang dipakai adalah
kredensial dari `DATABASE_URL` di `.env`, hanya nama database-nya yang diganti.

Nama database test bisa dioverride lewat variabel `TEST_DATABASE`.

## Catatan Perilaku Sesi

- Sesi login kedaluwarsa otomatis setelah `SESSION_TTL_DAYS` hari (default 7);
  token kedaluwarsa membalas `401 Unauthorized`.
- Baris sesi yang sudah kedaluwarsa dibersihkan secara lazy saat login
  berikutnya (tanpa cron).
- `sessions.user_id` memakai FK `ON DELETE CASCADE`: menghapus user ikut
  menghapus seluruh sesinya.
- Bentuk response setiap endpoint dideklarasikan lewat schema Elysia,
  sehingga field wajib (mis. tidak ada `password` di `/current`) terjamin.

## Struktur Folder

```
src/
  config/          # konfigurasi environment
  db/              # koneksi & schema database
    index.ts
    schema.ts
  middlewares/     # middleware, mis. error handler
  routes/          # routing ElysiaJS
    users-route.ts
  services/        # logic bisnis aplikasi
    users-service.ts
  index.ts         # entry point server
drizzle.config.ts  # konfigurasi Drizzle Kit
```

## Endpoint

| Method   | Path                 | Keterangan                        |
| -------- | -------------------- | --------------------------------- |
| `GET`    | `/health`            | Health check                      |
| `POST`   | `/api/users`         | Registrasi user baru              |
| `POST`   | `/api/users/login`   | Login user                        |
| `GET`    | `/api/users/current` | Ambil data user yang sedang login |
| `DELETE` | `/api/users/logout`  | Logout user                       |

### Registrasi User

**Request:**

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dicky","email":"dicky@localhost","password":"rahasia"}'
```

**Response sukses (`201`):**

```json
{ "data": "OK" }
```

**Response error (`409`):**

```json
{ "error": "Email sudah terdaftar" }
```

**Response error (`400`) jika input tidak lengkap:**

```json
{ "error": "Input tidak valid" }
```

### Login User

**Request:**

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dicky@localhost","password":"rahasia"}'
```

**Response sukses (`200`):**

```json
{ "data": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response error (`401`) jika email atau password salah:**

```json
{ "error": "Email atau password salah" }
```

### Get Current User

Membutuhkan token dari endpoint login (header `Authorization: Bearer <token>`).

**Request:**

```bash
curl http://localhost:3000/api/users/current \
  -H "Authorization: Bearer <token>"
```

**Response sukses (`200`):**

```json
{
  "data": {
    "id": 1,
    "name": "Dicky",
    "email": "dicky@localhost",
    "created_at": "2026-09-25T15:25:25.000Z"
  }
}
```

**Response error (`401`) jika token salah atau header tidak dikirim:**

```json
{ "error": "Unauthorized" }
```

### Logout User

Menghapus sesi (token) yang dikirim di header. Hanya sesi tersebut yang diakhiri —
sesi lain milik user yang sama tetap aktif.

**Request:**

```bash
curl -X DELETE http://localhost:3000/api/users/logout \
  -H "Authorization: Bearer <token>"
```

**Response sukses (`200`):**

```json
{ "data": "OK" }
```

**Response error (`401`) jika token salah atau header tidak dikirim:**

```json
{ "error": "Unauthorized" }
```

## Dokumentasi API (Swagger)

API ini dilengkapi Swagger UI interaktif, sehingga developer lain bisa melihat
semua endpoint, format request/response, dan mencoba API langsung dari browser
tanpa perlu membaca source code.

| Halaman                 | URL                                |
| ----------------------- | ---------------------------------- |
| Swagger UI (interaktif) | http://localhost:3000/docs         |
| OpenAPI spec (JSON)     | http://localhost:3000/openapi.json |

Catatan:

- UI hanya tersedia saat server jalan (`bun run dev`).
- Port mengikuti `PORT` di `.env` (default `3000`).
- Untuk mencoba endpoint yang butuh autentikasi, klik **Authorize** lalu isi
  `Bearer <token>` yang didapat dari endpoint login.

## Script Database

| Script                | Fungsi                                  |
| --------------------- | --------------------------------------- |
| `bun run db:generate` | Generate file migrasi dari schema       |
| `bun run db:migrate`  | Jalankan migrasi ke database            |
| `bun run db:push`     | Push schema langsung tanpa file migrasi |
| `bun run db:studio`   | Buka Drizzle Studio                     |
