import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import * as DateTime from 'effect/DateTime'
import { constant } from 'effect/Function'

const utcNow = constant(DateTime.toDateUtc(DateTime.unsafeNow()))

export const todos = sqliteTable('todos', {
  id: integer('id', { mode: 'number' }).primaryKey({
    autoIncrement: true,
  }),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull()
    .$onUpdate(utcNow),
})
