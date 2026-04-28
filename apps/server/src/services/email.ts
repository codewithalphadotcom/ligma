import { Resend } from 'resend';

/**
 * Resend transactional email service.
 *
 * Lazy-initialised so the module can be imported in test environments where
 * `RESEND_API_KEY` is unset. In dev, missing config logs a warning and the
 * email payload is dumped to stdout so flows can still be exercised end-to-end.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Ligma <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

let client: Resend | null = null;
function getClient(): Resend | null {
    if (!RESEND_API_KEY) return null;
    if (!client) client = new Resend(RESEND_API_KEY);
    return client;
}

interface SendArgs {
    to: string;
    subject: string;
    html: string;
    text: string;
}

async function send({ to, subject, html, text }: SendArgs): Promise<void> {
    const c = getClient();
    if (!c) {
        console.warn(
            `[email] RESEND_API_KEY missing — dropping email to=${to} subject=${JSON.stringify(subject)}`,
        );
        console.warn(`[email] preview:\n${text}`);
        return;
    }
    const result = await c.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        text,
    });
    if (result.error) {
        // Resend returns errors on the response object instead of throwing.
        throw new Error(`resend send failed: ${result.error.name}: ${result.error.message}`);
    }
}

/* ---------- shared layout ---------- */

const BRAND = 'Ligma';

function layout(innerHtml: string): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${BRAND}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7f9;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">${BRAND}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 32px 40px;font-size:15px;line-height:1.55;color:#111827;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 24px 40px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                You are receiving this email because someone (hopefully you) used this address on ${BRAND}. If this wasn't you, you can safely ignore this message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function codeBlock(code: string): string {
    return `<div style="margin:24px 0;padding:18px 20px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:8px;color:#111827;">${code}</div>`;
}

/* ---------- public API ---------- */

export async function sendVerificationEmail(args: {
    to: string;
    name: string;
    code: string;
    expiresInMinutes: number;
}): Promise<void> {
    const { to, name, code, expiresInMinutes } = args;
    const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
    const html = layout(`
        <p style="margin:0 0 16px 0;">${greeting}</p>
        <p style="margin:0 0 8px 0;">Use the code below to verify your email address and finish creating your ${BRAND} account.</p>
        ${codeBlock(code)}
        <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">This code expires in ${expiresInMinutes} minutes. If you didn't try to sign up, you can ignore this email.</p>
    `);
    const text = [
        `${greeting}`,
        '',
        `Your ${BRAND} verification code is: ${code}`,
        `This code expires in ${expiresInMinutes} minutes.`,
        '',
        `If you didn't try to sign up, ignore this message.`,
    ].join('\n');
    await send({ to, subject: `Your ${BRAND} verification code: ${code}`, html, text });
}

export async function sendPasswordResetEmail(args: {
    to: string;
    code: string;
    expiresInMinutes: number;
}): Promise<void> {
    const { to, code, expiresInMinutes } = args;
    const html = layout(`
        <p style="margin:0 0 8px 0;">A password reset was requested for this ${BRAND} account.</p>
        <p style="margin:0 0 8px 0;">Use the code below to set a new password:</p>
        ${codeBlock(code)}
        <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">This code expires in ${expiresInMinutes} minutes. If you didn't request a reset, change your password immediately.</p>
    `);
    const text = [
        `A password reset was requested for your ${BRAND} account.`,
        '',
        `Reset code: ${code}`,
        `This code expires in ${expiresInMinutes} minutes.`,
        '',
        `If you didn't request this, change your password immediately.`,
    ].join('\n');
    await send({ to, subject: `Reset your ${BRAND} password: ${code}`, html, text });
}

export async function sendWelcomeEmail(args: { to: string; name: string }): Promise<void> {
    const { to, name } = args;
    const greeting = name ? `Welcome, ${escapeHtml(name)}!` : `Welcome to ${BRAND}!`;
    const dashboardUrl = `${APP_URL}/dashboard`;
    const html = layout(`
        <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${greeting}</h1>
        <p style="margin:0 0 12px 0;">Your ${BRAND} account is ready. Hop into your dashboard to create your first room and invite your team.</p>
        <p style="margin:24px 0;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;">Open dashboard</a>
        </p>
        <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">If the button doesn't work, paste this URL into your browser: <br/><span style="word-break:break-all;">${dashboardUrl}</span></p>
    `);
    const text = [
        greeting,
        '',
        `Your ${BRAND} account is ready. Open the dashboard to create your first room:`,
        dashboardUrl,
    ].join('\n');
    await send({ to, subject: `Welcome to ${BRAND}`, html, text });
}

/* ---------- helpers ---------- */

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            default:
                return '&#39;';
        }
    });
}
