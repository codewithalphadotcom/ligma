import NextAuth, { type DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

/**
 * Auth.js v5 configuration.
 *
 * The Express server is the canonical issuer of API JWTs. NextAuth is
 * a *session shell* — it calls Express, stores the Express JWT in its
 * encrypted session cookie, and exposes it back to the client/server as
 * `session.apiToken`. The WS handler and REST middleware on the server
 * keep verifying that JWT exactly the same way they always have.
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const sharedSecret = process.env.AUTH_SHARED_SECRET;

interface ExpressAuthResponse {
    token: string;
    user: { id: string; name: string; email: string; color: string };
}

async function expressLogin(email: string, password: string): Promise<ExpressAuthResponse | null> {
    const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExpressAuthResponse;
}

async function expressGoogleUpsert(args: {
    email: string;
    name: string;
    googleId: string;
}): Promise<ExpressAuthResponse | null> {
    if (!sharedSecret) {
        throw new Error('AUTH_SHARED_SECRET is not configured on the web server');
    }
    const res = await fetch(`${apiUrl}/auth/google-upsert`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-auth-shared-secret': sharedSecret,
        },
        body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExpressAuthResponse;
}

const credentialsSchema = {
    parse(raw: unknown): { email: string; password: string } | null {
        if (!raw || typeof raw !== 'object') return null;
        const r = raw as Record<string, unknown>;
        const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : '';
        const password = typeof r.password === 'string' ? r.password : '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        if (password.length < 1) return null;
        return { email, password };
    },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET,
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/login',
    },
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(raw) {
                const parsed = credentialsSchema.parse(raw);
                if (!parsed) return null;
                const data = await expressLogin(parsed.email, parsed.password);
                if (!data) return null;
                // The returned object becomes the `user` argument in the jwt callback
                // exactly once — on the original sign-in. We stuff `apiToken` and
                // `color` here so they end up in the encrypted JWT.
                return {
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    color: data.user.color,
                    apiToken: data.token,
                };
            },
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Restrict scope; we only need profile + email.
            authorization: { params: { scope: 'openid email profile' } },
        }),
    ],
    callbacks: {
        /**
         * Runs on every Google sign-in attempt. We mint an Express JWT here
         * via `/auth/google-upsert` and stash it on the `user` object so the
         * `jwt` callback can copy it into the session token. Returning `false`
         * blocks the sign-in.
         */
        async signIn({ user, account, profile }) {
            if (account?.provider !== 'google') return true; // credentials handled in authorize
            const email = profile?.email ?? user.email;
            const name = (profile?.name as string | undefined) ?? user.name ?? email ?? 'User';
            const googleId = (profile?.sub as string | undefined) ?? account.providerAccountId;
            if (!email || !googleId) return false;

            let data: ExpressAuthResponse | null = null;
            try {
                data = await expressGoogleUpsert({ email, name, googleId });
            } catch (err) {
                console.error('[signIn] expressGoogleUpsert failed:', err);
                return false;
            }
            if (!data) return false;
            // Mutate the user reference so `jwt` callback below sees these.
            (user as { apiToken?: string }).apiToken = data.token;
            (user as { color?: string }).color = data.user.color;
            user.id = data.user.id;
            user.name = data.user.name;
            user.email = data.user.email;
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                const u = user as typeof user & { apiToken?: string; color?: string };
                if (u.apiToken) token.apiToken = u.apiToken;
                if (u.color) token.color = u.color;
                if (u.id) token.userId = u.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.apiToken) session.apiToken = token.apiToken as string;
            if (token.color && session.user) {
                (session.user as typeof session.user & { color?: string }).color =
                    token.color as string;
            }
            if (token.userId && session.user) session.user.id = token.userId as string;
            return session;
        },
    },
});

declare module 'next-auth' {
    interface Session {
        apiToken?: string;
        user: {
            id: string;
            color?: string;
        } & DefaultSession['user'];
    }
    interface User {
        color?: string;
        apiToken?: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        apiToken?: string;
        color?: string;
        userId?: string;
    }
}
