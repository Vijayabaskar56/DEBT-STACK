// // import 'dotenv/config';
// // import { drizzle } from 'drizzle-orm/bun-sqlite';
import { EnvVars } from "@/common/env-vars";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { layer } from "./Database";
// // export const db = drizzle({ connection: { source: process.env.DATABASE_URL! }});

// import 'dotenv/config';
// import { drizzle } from 'drizzle-orm/bun-sqlite';
// import { Database } from 'bun:sqlite';

// const sqlite = new Database(process.env.DATABASE_URL!);
// export const db = drizzle({ client: sqlite });

export const DatabaseLive = Layer.unwrapEffect(
  EnvVars.pipe(
    Effect.map((envVars) =>
      layer({
        filePath: envVars.DATABASE_URL!,
      }),
    ),
  ),
).pipe(Layer.provide(EnvVars.Default));