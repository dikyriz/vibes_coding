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

   | Variabel       | Keterangan                                                                   |
   | -------------- | ---------------------------------------------------------------------------- |
   | `PORT`         | Port server (default `3000`)                                                 |
   | `DATABASE_URL` | Connection string MySQL (default `mysql://root@localhost:3306/vibes_coding`) |

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

| Method | Path                 | Keterangan                        |
| ------ | -------------------- | --------------------------------- |
| `GET`  | `/health`            | Health check                      |
| `POST` | `/api/users`         | Registrasi user baru              |
| `POST` | `/api/users/login`   | Login user                        |
| `GET`  | `/api/users/current` | Ambil data user yang sedang login |

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

## Script Database

| Script                | Fungsi                                  |
| --------------------- | --------------------------------------- |
| `bun run db:generate` | Generate file migrasi dari schema       |
| `bun run db:migrate`  | Jalankan migrasi ke database            |
| `bun run db:push`     | Push schema langsung tanpa file migrasi |
| `bun run db:studio`   | Buka Drizzle Studio                     |
