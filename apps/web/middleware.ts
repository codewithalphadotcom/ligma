import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PROTECTED = [/^\/dashboard(\/|$)/];

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const needsAuth = PROTECTED.some((re) => re.test(pathname));
    if (!needsAuth) return NextResponse.next();

    if (!req.auth) {
        const loginUrl = new URL('/login', req.nextUrl);
        loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
});

// Run middleware everywhere except Next.js internals & static assets so the
// matcher above can apply uniform protection rules.
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
