// Legacy compatibility shim. The Drizzle-based client lives in `./index.ts`;
// this module re-exports the bits that the old `pg`-based code paths used so
// any straggling import keeps compiling. New code should import from
// `@/db/index.js` directly.
export { db, sql, schema } from './index.js';
