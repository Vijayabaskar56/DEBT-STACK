import { config } from 'dotenv'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'

config()

const sqlite = new Database(process.env.DATABASE_URL || 'local.db')
const db = drizzle(sqlite)

migrate(db, { migrationsFolder: './drizzle' })
