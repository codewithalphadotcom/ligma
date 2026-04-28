import {
    bigserial,
    boolean,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    serial,
    text,
    timestamp,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    /**
     * Nullable so OAuth-only users (e.g. Google sign-in) can exist without a
     * password. The credentials login route refuses logins when this is null.
     */
    passwordHash: text('password_hash'),
    googleId: text('google_id').unique(),
    color: text('color').notNull(),
    /**
     * Set to true once an email OTP has been redeemed (credentials signups)
     * or the account was created via a verified OAuth provider (Google).
     * Login is blocked while this is false for credentials-based logins.
     */
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/**
 * Stores OTP challenges for email verification and password reset. The
 * raw 6-digit code is bcrypt-hashed; we never persist plaintext.
 *
 * Lifecycle: a single (email, purpose) tuple has at most one row with
 * `used = false AND expires_at > now()`. Generating a new code marks
 * any prior unused rows as used to prevent replay.
 */
export const emailOtps = pgTable('email_otps', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: varchar('purpose', { length: 32 }).notNull().$type<'verify_email' | 'password_reset'>(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').notNull().default(false),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const roomMembers = pgTable(
    'room_members',
    {
        roomId: uuid('room_id')
            .notNull()
            .references(() => rooms.id),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        role: text('role').notNull().$type<'lead' | 'contributor' | 'viewer'>(),
    },
    (t) => ({ pk: primaryKey({ columns: [t.roomId, t.userId] }) }),
);

export const events = pgTable('events', {
    id: serial('id').primaryKey(),
    seqId: bigserial('seq_id', { mode: 'number' }).notNull().unique(),
    roomId: uuid('room_id')
        .notNull()
        .references(() => rooms.id),
    userId: uuid('user_id').references(() => users.id),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    nodeId: text('node_id'),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable('tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
        .notNull()
        .references(() => rooms.id),
    nodeId: text('node_id').notNull(),
    authorId: uuid('author_id').references(() => users.id),
    authorName: text('author_name').notNull(),
    status: text('status').notNull().default('open').$type<'open' | 'done'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type EmailOtp = typeof emailOtps.$inferSelect;
export type NewEmailOtp = typeof emailOtps.$inferInsert;
