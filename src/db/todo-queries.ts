import { eq } from 'drizzle-orm'
import { Database } from './Database'
import { todos } from './schema'
import * as Effect from 'effect/Effect'
import { Todo, TodoId, TodoNotFound } from '@/api/todo-schema'

// Convert database row to Todo schema
const dbRowToTodo = (row: typeof todos.$inferSelect): Todo => ({
  id: row.id.toString() as TodoId,
  title: row.title,
  completed: Boolean(row.completed),
  createdAt: row.createdAt as any, // Date from database, cast to DateTimeUtc
})

// Database operations service
export class TodoQueries extends Effect.Service<TodoQueries>()('TodoQueries', {
  effect: Effect.gen(function* () {
    const db = yield* Database

    const findAll = db
      .execute((client) => client.select().from(todos))
      .pipe(
        Effect.map((rows: any) =>
          (rows as (typeof todos.$inferSelect)[]).map(dbRowToTodo),
        ),
        Effect.catchTag('DatabaseError', (error) =>
          Effect.die(`Database error in findAll: ${error.message}`),
        ),
      )

    const findById = (id: TodoId) =>
      db
        .execute((client) =>
          client
            .select()
            .from(todos)
            .where(eq(todos.id, parseInt(id, 10))),
        )
        .pipe(
          Effect.flatMap((rows: any) => {
            const row = (rows as (typeof todos.$inferSelect)[])[0]
            if (!row) {
              return Effect.fail(new TodoNotFound({ id }))
            }
            return Effect.succeed(dbRowToTodo(row))
          }),
          Effect.catchTag('DatabaseError', (error) =>
            Effect.die(`Database error in findById: ${error.message}`),
          ),
        )

    const create = (input: { title: string; completed?: boolean }) =>
      db
        .execute((client) =>
          client
            .insert(todos)
            .values({
              title: input.title,
              completed: input.completed ?? false,
            })
            .returning(),
        )
        .pipe(
          Effect.map((rows: any) =>
            dbRowToTodo((rows as (typeof todos.$inferSelect)[])[0]),
          ),
          Effect.catchTag('DatabaseError', (error) =>
            Effect.die(`Database error in create: ${error.message}`),
          ),
        )

    const update = (
      id: TodoId,
      updates: { title?: string; completed?: boolean },
    ) =>
      db
        .execute((client) =>
          client
            .update(todos)
            .set({
              ...(updates.title && { title: updates.title }),
              ...(updates.completed !== undefined && {
                completed: updates.completed,
              }),
            })
            .where(eq(todos.id, parseInt(id, 10)))
            .returning(),
        )
        .pipe(
          Effect.flatMap((rows: any) => {
            const row = (rows as (typeof todos.$inferSelect)[])[0]
            if (!row) {
              return Effect.fail(new TodoNotFound({ id }))
            }
            return Effect.succeed(dbRowToTodo(row))
          }),
          Effect.catchTag('DatabaseError', (error) =>
            Effect.die(`Database error in update: ${error.message}`),
          ),
        )

    const remove = (id: TodoId) =>
      db
        .execute((client) =>
          client
            .delete(todos)
            .where(eq(todos.id, parseInt(id, 10)))
            .returning(),
        )
        .pipe(
          Effect.flatMap((rows: any) => {
            if ((rows as (typeof todos.$inferSelect)[]).length === 0) {
              return Effect.fail(new TodoNotFound({ id }))
            }
            return Effect.succeed(undefined)
          }),
          Effect.catchTag('DatabaseError', (error) =>
            Effect.die(`Database error in remove: ${error.message}`),
          ),
        )

    return {
      findAll,
      findById,
      create,
      update,
      remove,
    } as const
  }),
}) {}
