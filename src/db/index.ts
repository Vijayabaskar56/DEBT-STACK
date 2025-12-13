// import 'dotenv/config';
// import { drizzle } from 'drizzle-orm/bun-sqlite';

// export const db = drizzle({ connection: { source: process.env.DATABASE_URL! }});

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database(process.env.DATABASE_URL!);
export const db = drizzle({ client: sqlite });
