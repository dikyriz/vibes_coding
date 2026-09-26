export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? "mysql://root@localhost:3306/vibes_coding",
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
};
