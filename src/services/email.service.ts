import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Config & transporter
// ---------------------------------------------------------------------------

function parsePort(raw: string | undefined): number {
  const port = parseInt(raw ?? '587', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid EMAIL_PORT value: "${raw}". Must be 1–65535.`);
  }
  return port;
}

const smtpConfig = {
  host: process.env.EMAIL_HOST,
  port: parsePort(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  pool: true,
  maxConnections: parseInt(process.env.EMAIL_POOL_MAX ?? '5', 10),
  maxMessages: parseInt(process.env.EMAIL_POOL_MAX_MESSAGES ?? '100', 10),
  connectionTimeout: 10_000,  // 10 s to establish connection
  greetingTimeout: 10_000,    // 10 s for SMTP greeting
  socketTimeout: 30_000,      // 30 s of inactivity before giving up
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

/** Call once at app start (e.g. in server.ts) to fail fast on bad credentials. */
export async function verifyTransporter(): Promise<void> {
  await transporter.verify();
  console.log('SMTP connection verified successfully.');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  /** Full HTML body. A plain-text fallback is derived automatically. */
  html: string;
  /** Plain-text override. Derived from `html` if omitted. */
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
}

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(address: string): boolean {
  return EMAIL_RE.test(address.trim());
}

function validateAddresses(field: string, value: string | string[]): void {
  const addresses = Array.isArray(value) ? value : [value];
  if (addresses.length === 0) throw new Error(`"${field}" must not be empty.`);
  for (const addr of addresses) {
    if (!isValidEmail(addr)) {
      throw new Error(`Invalid email address in "${field}": ${addr}`);
    }
  }
}

/** Converts HTML to readable plain text (handles entities & collapses whitespace). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/?(h[1-6]|div|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')              // strip remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')          // collapse excess newlines
    .trim();
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts;
      console.warn(
        `[mailer] ${label} — attempt ${attempt}/${maxAttempts} failed:`,
        err instanceof Error ? err.message : err,
      );
      if (!isLast) await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Main send function
// ---------------------------------------------------------------------------

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { to, subject, html, text, cc, bcc, replyTo, attachments } = payload;

  // --- Validate inputs before touching the network ---
  try {
    if (!subject?.trim()) throw new Error('"subject" must not be empty.');
    if (!html?.trim()) throw new Error('"html" must not be empty.');
    validateAddresses('to', to);
    if (cc) validateAddresses('cc', cc);
    if (bcc) validateAddresses('bcc', bcc);
    if (replyTo && !isValidEmail(replyTo)) {
      throw new Error(`Invalid "replyTo" address: ${replyTo}`);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[mailer] Validation error:', error);
    return { success: false, error };
  }

  // --- Send (with retry) ---
  try {
    const info = await withRetry('sendMail', () =>
      transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME ?? 'App Team'}" <${
          process.env.EMAIL_FROM_ADDRESS ?? 'noreply@yourdomain.com'
        }>`,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        html,
        text: text ?? htmlToText(html),
        attachments,
      }),
    );

    console.log(`[mailer] Email sent — messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('[mailer] Failed to send email:', error);
    return { success: false, error };
  }
}

// ---------------------------------------------------------------------------
// Shared HTML layout
// ---------------------------------------------------------------------------

const BRAND_COLOR = '#4F46E5'; // indigo-600
const BRAND_NAME = process.env.EMAIL_FROM_NAME ?? 'Venue Portal';

function wrapInLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <!-- Header -->
  <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${BRAND_NAME}</h1>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${title}</h2>
    ${bodyHtml}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
    <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">
      This is an automated message from ${BRAND_NAME}. Please do not reply directly to this email.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function detailsTable(rows: [string, string][]): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-size:14px;color:#71717a;white-space:nowrap;border-bottom:1px solid #f4f4f5;">${label}</td>
          <td style="padding:8px 12px;font-size:14px;color:#18181b;border-bottom:1px solid #f4f4f5;">${value}</td>
        </tr>`,
    )
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">${trs}</table>`;
}

function formatDate(d: Date): string {
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function actionButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>
  </td></tr></table>`;
}

// ---------------------------------------------------------------------------
// Domain-specific booking data interface
// ---------------------------------------------------------------------------

export interface BookingEmailData {
  bookingId: number;
  eventName: string;
  venueName: string;
  eventStart: Date;
  eventEnd: Date;
  clubName: string;
  /** Optional portal URL for CTA buttons */
  portalUrl?: string;
}

// ---------------------------------------------------------------------------
// 1. Booking Submitted — sent to the club that created the booking
// ---------------------------------------------------------------------------

export async function sendBookingSubmittedEmail(
  clubEmail: string,
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      Your booking request has been successfully submitted and is now <strong>pending review</strong>.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
      ['Club', data.clubName],
    ])}
    <p style="font-size:14px;color:#3f3f46;">
      You will receive another email once a decision has been made.
    </p>
    ${data.portalUrl ? actionButton('View Booking', `${data.portalUrl}/bookings/${data.bookingId}`) : ''}
  `;

  return sendEmail({
    to: clubEmail,
    subject: `Booking Submitted — ${data.eventName} (#${data.bookingId})`,
    html: wrapInLayout('Booking Request Submitted', body),
  });
}

// ---------------------------------------------------------------------------
// 2. New Booking for Handler — sent to the assigned faculty/staff handler
// ---------------------------------------------------------------------------

export async function sendHandlerAssignedEmail(
  handlerEmail: string,
  handlerName: string,
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      Hi <strong>${handlerName}</strong>,
    </p>
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      A new venue booking request requires your review and action.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Requested by', data.clubName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
    ])}
    <p style="font-size:14px;color:#3f3f46;">
      Please log in to the portal to approve or reject this request.
    </p>
    ${data.portalUrl ? actionButton('Review Booking', `${data.portalUrl}/bookings/${data.bookingId}`) : ''}
  `;

  return sendEmail({
    to: handlerEmail,
    subject: `Action Required — Booking #${data.bookingId}: ${data.eventName}`,
    html: wrapInLayout('New Booking Requires Your Review', body),
  });
}

// ---------------------------------------------------------------------------
// 3. Booking Approved — sent to the club
// ---------------------------------------------------------------------------

export async function sendBookingApprovedEmail(
  clubEmail: string,
  data: BookingEmailData,
  approverName: string,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      Great news! Your booking request has been <strong style="color:#16a34a;">approved</strong>.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
      ['Approved by', approverName],
    ])}
    <p style="font-size:14px;color:#3f3f46;">
      The venue is now reserved for your event. Please ensure all arrangements are in order.
    </p>
    ${data.portalUrl ? actionButton('View Booking', `${data.portalUrl}/bookings/${data.bookingId}`) : ''}
  `;

  return sendEmail({
    to: clubEmail,
    subject: `✅ Booking Approved — ${data.eventName} (#${data.bookingId})`,
    html: wrapInLayout('Booking Approved', body),
  });
}

// ---------------------------------------------------------------------------
// 4. Booking Rejected — sent to the club
// ---------------------------------------------------------------------------

export async function sendBookingRejectedEmail(
  clubEmail: string,
  data: BookingEmailData,
  rejectorName: string,
  reason?: string,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      Unfortunately, your booking request has been <strong style="color:#dc2626;">rejected</strong>.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
      ['Rejected by', rejectorName],
      ...(reason ? [['Reason', reason] as [string, string]] : []),
    ])}
    <p style="font-size:14px;color:#3f3f46;">
      You may submit a new request for a different time slot or venue if needed.
    </p>
    ${data.portalUrl ? actionButton('Submit New Request', `${data.portalUrl}/bookings/new`) : ''}
  `;

  return sendEmail({
    to: clubEmail,
    subject: `❌ Booking Rejected — ${data.eventName} (#${data.bookingId})`,
    html: wrapInLayout('Booking Rejected', body),
  });
}

// ---------------------------------------------------------------------------
// 5. Booking Cancelled — sent to the club and handler
// ---------------------------------------------------------------------------

export async function sendBookingCancelledEmail(
  recipients: string[],
  data: BookingEmailData,
  cancelledBy: string,
  reason?: string,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      The following booking has been <strong style="color:#d97706;">cancelled</strong>.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Club', data.clubName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
      ['Cancelled by', cancelledBy],
      ...(reason ? [['Reason', reason] as [string, string]] : []),
    ])}
    <p style="font-size:14px;color:#71717a;font-size:13px;">
      This venue slot is now available for other bookings.
    </p>
  `;

  return sendEmail({
    to: recipients,
    subject: `Booking Cancelled — ${data.eventName} (#${data.bookingId})`,
    html: wrapInLayout('Booking Cancelled', body),
  });
}

// ---------------------------------------------------------------------------
// 6. Booking Withdrawn — sent to the handler when a club withdraws
// ---------------------------------------------------------------------------

export async function sendBookingWithdrawnEmail(
  handlerEmail: string,
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      The booking listed below has been <strong>withdrawn</strong> by <strong>${data.clubName}</strong>.
      No further action is required from your side.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Club', data.clubName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
    ])}
  `;

  return sendEmail({
    to: handlerEmail,
    subject: `Booking Withdrawn — ${data.eventName} (#${data.bookingId})`,
    html: wrapInLayout('Booking Withdrawn', body),
  });
}

// ---------------------------------------------------------------------------
// 7. Booking Reminder — sent to the handler for pending reviews
// ---------------------------------------------------------------------------

export async function sendBookingReminderEmail(
  handlerEmail: string,
  handlerName: string,
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const body = `
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      Hi <strong>${handlerName}</strong>,
    </p>
    <p style="font-size:14px;color:#3f3f46;line-height:1.6;">
      This is a friendly reminder that the following booking is still <strong>awaiting your review</strong>.
    </p>
    ${detailsTable([
      ['Booking ID', `#${data.bookingId}`],
      ['Event', data.eventName],
      ['Requested by', data.clubName],
      ['Venue', data.venueName],
      ['Start', formatDate(data.eventStart)],
      ['End', formatDate(data.eventEnd)],
    ])}
    <p style="font-size:14px;color:#3f3f46;">
      Please take action at your earliest convenience.
    </p>
    ${data.portalUrl ? actionButton('Review Now', `${data.portalUrl}/bookings/${data.bookingId}`) : ''}
  `;

  return sendEmail({
    to: handlerEmail,
    subject: `⏰ Reminder — Booking #${data.bookingId} Awaiting Review`,
    html: wrapInLayout('Pending Booking Reminder', body),
  });
}