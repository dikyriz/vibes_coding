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

   | Variabel       | Keterangan                   |
   | -------------- | ---------------------------- |
   | `PORT`         | Port server (default `3000`) |
   | `DATABASE_URL` | Connection string MySQL      |

3. Buat tabel di database (pilih salah satu):

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
  modules/         # fitur per domain
    users/
      users.route.ts
      users.service.ts
  index.ts         # entry point server
drizzle.config.ts  # konfigurasi Drizzle Kit
```

## Endpoint

| Method   | Path             | Keterangan      |
| -------- | ---------------- | --------------- |
| `GET`    | `/health`        | Health check    |
| `GET`    | `/api/users`     | List semua user |
| `GET`    | `/api/users/:id` | Detail user     |
| `POST`   | `/api/users`     | Buat user baru  |
| `PATCH`  | `/api/users/:id` | Update user     |
| `DELETE` | `/api/users/:id` | Hapus user      |

Contoh:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi","email":"budi@example.com"}'
```

## Script Database

| Script                | Fungsi                                  |
| --------------------- | --------------------------------------- |
| `bun run db:generate` | Generate file migrasi dari schema       |
| `bun run db:migrate`  | Jalankan migrasi ke database            |
| `bun run db:push`     | Push schema langsung tanpa file migrasi |
| `bun run db:studio`   | Buka Drizzle Studio                     |
