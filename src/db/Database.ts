import { Database as SQLiteDatabase } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as Cause from 'effect/Cause'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Runtime from 'effect/Runtime'
import * as DbSchema from './schema.js'
import * as Redacted  from 'effect/Redacted'

type TransactionClient = BunSQLiteDatabase<typeof DbSchema>

type Client = BunSQLiteDatabase<typeof DbSchema> & {
  $client: SQLiteDatabase
}

type TransactionContextShape = <U>(
  fn: (client: TransactionClient) => Promise<U>,
) => Effect.Effect<U, DatabaseError>
export class TransactionContext extends Context.Tag('TransactionContext')<
  TransactionContext,
  TransactionContextShape
>() {
  public static readonly provide = (
    transaction: TransactionContextShape,
  ): (<A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, Exclude<R, TransactionContext>>) =>
    Effect.provideService(this, transaction)
}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly type:
    | 'unique_violation'
    | 'foreign_key_violation'
    | 'connection_error'
  readonly cause: Error
}> {
  public override toString() {
    return `DatabaseError: ${this.cause.message}`
  }

  public get message() {
    return this.cause.message
  }
}

const matchSQLiteError = (error: unknown) => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('unique constraint') ||
      message.includes('constraint failed')
    ) {
      return new DatabaseError({ type: 'unique_violation', cause: error })
    }
    if (
      message.includes('foreign key constraint') ||
      message.includes('foreign key')
    ) {
      return new DatabaseError({ type: 'foreign_key_violation', cause: error })
    }
    if (
      message.includes('connection') ||
      message.includes('database is locked')
    ) {
      return new DatabaseError({ type: 'connection_error', cause: error })
    }
  }
  return null
}

export class DatabaseConnectionLostError extends Data.TaggedError(
  'DatabaseConnectionLostError',
)<{
  cause: unknown
  message: string
}> {}

export type Config = {
  filePath: Redacted.Redacted;
}

const makeService = (config: Config) =>
  Effect.gen(function* () {
    const sqlite = yield* Effect.acquireRelease(
      Effect.sync(() => new SQLiteDatabase(Redacted.value(config.filePath))),
      (db) => Effect.sync(() => db.close()),
    )

    yield* Effect.sync(() => sqlite.exec('SELECT 1')).pipe(
      Effect.tap(() =>
        Effect.logInfo(
          '[Database client]: Connection to the database established.',
        ),
      ),
    )

    const setupConnectionListeners = Effect.logInfo(
      '[Database client]: SQLite database initialized.',
    )

    const db = drizzle({ client: sqlite, schema: DbSchema })

    const execute = Effect.fn(<T>(fn: (client: Client) => Promise<T>) =>
      Effect.tryPromise({
        try: () => fn(db),
        catch: (cause) => {
          const error = matchSQLiteError(cause)
          if (error !== null) {
            return error
          }
          throw cause
        },
      }),
    )

    const transaction = Effect.fn('Database.transaction')(
      <T, E, R>(
        txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>,
      ) =>
        Effect.runtime<R>().pipe(
          Effect.map((runtime) => Runtime.runPromiseExit(runtime)),
          Effect.flatMap((runPromiseExit) =>
            Effect.async<T, DatabaseError | E, R>((resume) => {
              db.transaction(async (tx: TransactionClient) => {
                const txWrapper = (
                  fn: (client: TransactionClient) => Promise<any>,
                ) =>
                  Effect.tryPromise({
                    try: () => fn(tx),
                    catch: (cause) => {
                      const error = matchSQLiteError(cause)
                      if (error !== null) {
                        return error
                      }
                      throw cause
                    },
                  })

                const result = await runPromiseExit(txExecute(txWrapper))
                Exit.match(result, {
                  onSuccess: (value) => {
                    resume(Effect.succeed(value))
                  },
                  onFailure: (cause) => {
                    if (Cause.isFailure(cause)) {
                      resume(Effect.fail(Cause.originalError(cause) as E))
                    } else {
                      resume(Effect.die(cause))
                    }
                  },
                })
              }).catch((cause) => {
                const error = matchSQLiteError(cause)
                resume(error !== null ? Effect.fail(error) : Effect.die(cause))
              })
            }),
          ),
        ),
    )

    type ExecuteFn = <T>(
      fn: (client: Client | TransactionClient) => Promise<T>,
    ) => Effect.Effect<T, DatabaseError>
    const makeQuery =
      <A, E, R, Input = never>(
        queryFn: (execute: ExecuteFn, input: Input) => Effect.Effect<A, E, R>,
      ) =>
      (
        ...args: [Input] extends [never] ? [] : [input: Input]
      ): Effect.Effect<A, E, R> => {
        const input = args[0] as Input
        return Effect.serviceOption(TransactionContext).pipe(
          Effect.map(Option.getOrNull),
          Effect.flatMap((txOrNull) => queryFn(txOrNull ?? execute, input)),
        )
      }

    return {
      execute,
      transaction,
      setupConnectionListeners,
      makeQuery,
    } as const
  })

type Shape = Effect.Effect.Success<ReturnType<typeof makeService>>

export class Database extends Effect.Tag('Database')<Database, Shape>() {}

export const layer = (config: Config) =>
  Layer.scoped(Database, makeService(config))
