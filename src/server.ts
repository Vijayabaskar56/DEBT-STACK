// src/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { DatabaseLive } from './db'
import { EnvVars } from './common/env-vars'

// Define request context type for Effect services
type RequestContext = {
  database: typeof DatabaseLive
  env: typeof EnvVars.Default
}

// TypeScript module augmentation for TanStack Start
declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: RequestContext
    }
  }
}

export default createServerEntry({
  async fetch(request) {
    // Provide Effect services via request context
    // The services will be available in server functions and routes
    return handler.fetch(request, {
      context: {
        database: DatabaseLive,
        env: EnvVars.Default,
      },
    })
  },
})
