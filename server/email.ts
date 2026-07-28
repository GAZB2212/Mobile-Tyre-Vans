import { Resend } from 'resend';
import { BRAND, siteUrl as brandSiteUrl } from "@shared/brand";
import { storage } from './storage';

// ── Internal notification routing ────────────────────────────────────────────
// Each internal email triggered by the platform belongs to a NotifyChannel.
// Admins assign recipients to channels via Admin → Settings → Notification
// Recipients (site_settings key `admin_notify_recipients`). Each person can
// subscribe to any subset of channels — so e.g. Beth can receive only the
// "Send to Admin" depot-invoice emails while Carl/Graham still get the full
// new-quote firehose.
//
// Storage shape (JSON): { email: string, channels: NotifyChannel[] }[]
//
// Back-compat: if only the old `admin_notify_emails` key (plain string[])
// exists, each address is treated as subscribed to every channel except
// `depot_invoice` (that one historically had its own hardcoded default).
//
// Fallback: if nothing is configured at all, channel-specific defaults below
// are used so the system keeps emailing somebody rather than silently dropping.

export const NOTIFY_CHANNELS = [
  { id: 'configurator_submission', label: 'New configurator submission',  description: 'Customer clicks Send on the configurator/quote builder.' },
  { id: 'lead_enquiry',            label: 'New lead enquiry',              description: 'Contact-form / "Get in touch" submissions.' },
  { id: 'option_chosen',           label: 'Customer chose Option A/B',     description: 'Customer picked A or B from a comparison email.' },
  { id: 'quote_correction',        label: 'Quote correction request',      description: 'Customer requested changes to their quote.' },
  { id: 'spec_approval',           label: 'Spec approval / flagged',       description: 'Customer approved or rejected their spec sheet.' },
  { id: 'finance_update',          label: 'Finance status update',         description: 'Finance team status change.' },
  { id: 'artwork_approval',        label: 'Artwork approval / changes',    description: 'WrapGen artwork response from customer.' },
  { id: 'depot_invoice',           label: '"Send to Admin" invoice email', description: 'Send-to-Admin button on a quote — full build spec + pricing.' },
] as const;
export type NotifyChannel = typeof NOTIFY_CHANNELS[number]['id'];
const ALL_CHANNEL_IDS = NOTIFY_CHANNELS.map((c) => c.id) as readonly NotifyChannel[];
const NON_DEPOT_CHANNELS = ALL_CHANNEL_IDS.filter((c) => c !== 'depot_invoice');

// Channel-specific safety-net defaults used when nothing is configured.
// Configure via ADMIN_NOTIFY_FALLBACK_EMAIL env var or Admin → Settings →
// Notification Recipients; with neither set, internal notifications are
// logged and skipped rather than emailed to a hardcoded address.
const FALLBACK_RECIPIENT = process.env.ADMIN_NOTIFY_FALLBACK_EMAIL;
const DEFAULT_BROAD_RECIPIENTS = FALLBACK_RECIPIENT ? [FALLBACK_RECIPIENT] : [];
const DEFAULT_DEPOT_RECIPIENTS = FALLBACK_RECIPIENT ? [FALLBACK_RECIPIENT] : [];

export const ADMIN_NOTIFY_RECIPIENTS_KEY = 'admin_notify_recipients';
export const ADMIN_NOTIFY_EMAILS_KEY = 'admin_notify_emails'; // legacy (back-compat)

export type NotifyRecipient = { email: string; channels: NotifyChannel[] };

/**
 * Reads the configured recipient list. Returns [] if nothing is configured.
 * Handles the legacy `admin_notify_emails` shape by promoting each address
 * to subscribe to every non-depot channel.
 */
export async function getNotifyRecipients(): Promise<NotifyRecipient[]> {
  try {
    const settings = await storage.getSiteSettings();
    const raw = settings[ADMIN_NOTIFY_RECIPIENTS_KEY];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const out: NotifyRecipient[] = [];
        for (const r of parsed) {
          if (!r || typeof r !== 'object') continue;
          const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : '';
          if (!email) continue;
          const channels = Array.isArray(r.channels)
            ? (r.channels.filter((c: unknown): c is NotifyChannel => typeof c === 'string' && (ALL_CHANNEL_IDS as readonly string[]).includes(c)))
            : [];
          out.push({ email, channels });
        }
        return out;
      }
    }
    // Legacy fallback
    const legacy = settings[ADMIN_NOTIFY_EMAILS_KEY];
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((e): e is string => typeof e === 'string')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0)
          .map((email) => ({ email, channels: [...NON_DEPOT_CHANNELS] }));
      }
    }
  } catch {
    // fall through to defaults
  }
  return [];
}

/**
 * Resolves the recipient list for one channel. Falls back to channel-specific
 * defaults when no one is subscribed (so notifications never silently vanish).
 */
export async function getInternalNotifyEmails(channel: NotifyChannel): Promise<string[]> {
  const recipients = await getNotifyRecipients();
  const matched = recipients.filter((r) => r.channels.includes(channel)).map((r) => r.email);
  if (matched.length > 0) {
    return Array.from(new Set(matched));
  }
  return channel === 'depot_invoice' ? DEFAULT_DEPOT_RECIPIENTS : DEFAULT_BROAD_RECIPIENTS;
}

/** Returns true for email addresses that belong to test/e2e runs and must never receive real mail. */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith('@example.com') || email.endsWith('.example.com');
}

let connectionSettings: any;
let fromEmailLogged = false;

const DEFAULT_FROM_EMAIL = `${BRAND.name} <noreply@${BRAND.domain.replace(/^www\./, "")}>`;

async function getCredentials() {
  const fromEmail = process.env.MAIL_FROM || DEFAULT_FROM_EMAIL;

  if (!fromEmailLogged) {
    fromEmailLogged = true;
    if (!process.env.MAIL_FROM) {
      console.warn(`[EMAIL] WARN: MAIL_FROM not set, falling back to default sender: ${fromEmail}`);
    } else {
      console.info(`[EMAIL] Sender address resolved: ${fromEmail}`);
    }
  }

  if (process.env.RESEND_API_KEY) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail,
  };
}

// ── Startup health check ──────────────────────────────────────────────────────
export function checkEmailConfig(): void {
  const issues: string[] = [];

  if (!process.env.MAIL_FROM) {
    issues.push(`MAIL_FROM is not set — emails will be sent from the default address (${DEFAULT_FROM_EMAIL}). Set MAIL_FROM to override.`);
  }

  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasConnectorHost = !!process.env.REPLIT_CONNECTORS_HOSTNAME;
  const hasReplToken = !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);

  if (!hasResendKey && !(hasConnectorHost && hasReplToken)) {
    issues.push('No Resend credentials found — RESEND_API_KEY is not set and the Replit Resend connector does not appear to be configured. Emails will fail until this is resolved.');
  }

  if (issues.length === 0) {
    console.info('[EMAIL] Health check passed — email configuration looks good.');
    return;
  }

  for (const issue of issues) {
    console.warn(`[EMAIL] WARN: ${issue}`);
  }
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

// Resend v4 resolves to { data, error } and does NOT throw on API errors
// (bad domain, invalid recipient, rate limit). Every send in this file goes
// through this wrapper so a failed send surfaces as a thrown error instead of
// silently "succeeding" while workflow state advances.
async function sendOrThrow(client: Resend, payload: any) {
  const { data, error } = await client.emails.send(payload);
  if (error) {
    console.error('[EMAIL] Send failed:', { to: payload?.to, subject: payload?.subject, error });
    throw new Error(`Email send failed: ${(error as any)?.message ?? JSON.stringify(error)}`);
  }
  return data;
}

// ── Shared brand constants ────────────────────────────────────────────────────
const BRAND_GREEN = BRAND.theme.accentHex;
const BRAND_DARK = BRAND.theme.darkHex;
const SITE_DOMAIN = BRAND.domain;
const BRAND_NAME = BRAND.name;
// Logo file is committed at client/public/favicon.png.
// Vite serves client/public/ at the site root so the file is accessible at /favicon.png.
// Priority: SITE_URL env var → first domain in REPLIT_DOMAINS (works in both dev and production
// Replit deployments automatically) → hardcoded production domain as last resort.
function resolveLogoUrl(): string {
  if (process.env.SITE_URL) return `${process.env.SITE_URL}/favicon.png`;
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const firstDomain = replitDomains.split(',')[0].trim();
    return `https://${firstDomain}/favicon.png`;
  }
  return `https://${SITE_DOMAIN}/favicon.png`;
}
const LOGO_URL = resolveLogoUrl();
const ADDRESS = BRAND.addressLines.join(', ');
const PHONE = BRAND.phone;

// ── Shared email layout ───────────────────────────────────────────────────────
export function emailLayout(
  bodyHtml: string,
  options?: {
    extraCss?: string;
    footerNote?: string;
    maxWidth?: number;
  }
): string {
  const { extraCss = '', footerNote, maxWidth = 600 } = options ?? {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .em-container { max-width: ${maxWidth}px; margin: 0 auto; width: 100%; }
    .em-header { background-color: ${BRAND_DARK}; padding: 24px 30px; text-align: center; }
    .em-header img { max-width: 220px; width: 100%; height: auto; display: block; margin: 0 auto; }
    .em-content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .em-footer { text-align: center; padding: 18px 20px; color: #6b7280; font-size: 13px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; }
    .em-footer a { color: ${BRAND_GREEN}; text-decoration: none; }
    ${extraCss}
    @media screen and (max-width: 600px) {
      .em-container { width: 100% !important; }
      .em-header { padding: 18px 16px !important; }
      .em-content { padding: 20px 16px !important; }
    }
  </style>
</head>
<body>
  <div class="em-container">
    <div class="em-header">
      <img src="${LOGO_URL}" alt="${BRAND_NAME}" />
    </div>
    <div class="em-content">
      ${bodyHtml}
    </div>
    <div class="em-footer">
      <p style="margin:0 0 3px;"><strong>${BRAND_NAME}</strong></p>
      <p style="margin:0 0 3px;">${ADDRESS}</p>
      <p style="margin:0;">${PHONE} &bull; <a href="https://${SITE_DOMAIN}">${SITE_DOMAIN}</a></p>
      ${footerNote ? `<p style="margin:12px 0 0; font-size:12px; color:#9ca3af;">${footerNote}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

// ── Quote confirmation (admin manually triggers this) ─────────────────────────
export async function sendQuoteConfirmationEmail({
  to,
  customerName,
  quoteId,
  confirmationUrl,
  totalPrice,
  discount,
  customerNotes,
}: {
  to: string;
  customerName: string;
  quoteId: string;
  confirmationUrl: string;
  totalPrice: number;
  discount?: number;
  customerNotes?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();

  const formattedTotal = `£${(totalPrice / 100).toLocaleString()}`;
  const savings = discount ? `£${(discount / 100).toLocaleString()}` : null;

  const body = `
    <p>Hi ${customerName},</p>
    <p>Thank you for requesting a quote for your mobile tyre van conversion. We've reviewed your configuration and are pleased to present your custom quote.</p>
    <div class="price-box">
      <h2 style="margin-top: 0;">Quote #${quoteId.slice(0, 8).toUpperCase()}</h2>
      ${savings ? `<div class="savings">Special Discount Applied — You Save ${savings}!</div>` : ''}
      <p style="font-size: 28px; font-weight: bold; color: ${BRAND_GREEN}; margin: 10px 0;">${formattedTotal}</p>
      <p style="color: #6b7280; margin: 0;">Including VAT</p>
    </div>
    ${customerNotes ? `
    <div class="note-box">
      <h3 style="margin-top: 0; color: #1e40af;">Note from our team:</h3>
      <p style="margin: 0; white-space: pre-wrap;">${customerNotes}</p>
    </div>
    ` : ''}
    <p>To proceed with your order, please review and confirm your quote by clicking the button below:</p>
    <div style="text-align: center;">
      <a href="${confirmationUrl}" class="cta-btn">Review &amp; Confirm Quote</a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">This confirmation link is for one-time use and will expire after confirmation.</p>
    <p>If you have any questions, please call us on <strong>${PHONE}</strong>.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to,
    from: fromEmail,
    subject: `Your Van Conversion Quote #${quoteId.slice(0, 8).toUpperCase()} is Ready`,
    html: emailLayout(body, {
      extraCss: `
        .price-box { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .cta-btn { display: block; max-width: 280px; margin: 20px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; box-sizing: border-box; }
        .savings { background-color: #dcfce7; color: #166534; padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: bold; }
        .note-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
        @media screen and (max-width: 600px) { .cta-btn { max-width: 100% !important; } }
      `,
      footerNote: "If you didn't request this quote, please disregard this email.",
    }),
    text: `Hi ${customerName},\n\nYour Van Conversion Quote #${quoteId.slice(0, 8).toUpperCase()} is Ready!\n\nTotal Price: ${formattedTotal} (Including VAT)\n${savings ? `Special Discount Applied - You Save ${savings}!\n` : ''}\n${customerNotes ? `Note from our team:\n${customerNotes}\n\n` : ''}To confirm your quote visit:\n${confirmationUrl}\n\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── Spec summary email: sent by admin after discussing with customer ───────────
export async function sendQuoteSpecSummaryEmail({
  to,
  customerName,
  quoteId,
  vanTitle,
  kitName,
  upgradeNames,
  subtotal,
  vat,
  total,
  discount,
  customerNote,
  approvalToken,
  siteBaseUrl,
  financeInfo,
  comparisonSlotB,
  chosenOption,
  customExtras = [],
  chooseOptionToken,
}: {
  to: string;
  customerName: string;
  quoteId: string;
  vanTitle?: string | null;
  kitName?: string | null;
  upgradeNames?: string[];
  subtotal: number;
  vat: number;
  total: number;
  discount?: number;
  customerNote?: string | null;
  approvalToken?: string;
  siteBaseUrl?: string;
  financeInfo?: {
    depositAmount: number;
    termMonths: number;
    monthlyPayment: number;
    weeklyPayment: number;
  } | null;
  comparisonSlotB?: {
    vanTitle?: string | null;
    kitName?: string | null;
    upgradeNames?: string[];
    estSubtotal?: number;
    estVAT?: number;
    estTotal?: number;
    financeInfo?: {
      depositAmount: number;
      termMonths: number;
      monthlyPayment: number;
      weeklyPayment: number;
    } | null;
  } | null;
  chosenOption?: 'A' | 'B' | null;
  customExtras?: Array<{ id: string; description: string; pricePence: number }>;
  chooseOptionToken?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const ref = quoteId.slice(0, 8).toUpperCase();
  const isComparison = !!comparisonSlotB;
  const fmtPence = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const extrasHtmlRow = customExtras && customExtras.length > 0
    ? `<tr><td>Bespoke Extras</td><td><ul style="margin:2px 0;padding-left:18px;">${customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} — ${fmtPence(e.pricePence)}</li>`).join('')}</ul></td></tr>`
    : '';
  const extrasTextBlock = customExtras && customExtras.length > 0
    ? `Bespoke Extras:\n${customExtras.map(e => `  - ${e.description} (${fmtPence(e.pricePence)})`).join('\n')}\n`
    : '';

  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const totalAfterDiscount = discount && discount > 0 ? total - discount : total;
  const originalPriceLine = discount && discount > 0
    ? `<tr><td>Original Price (inc. VAT)</td><td>${fmt(total)}</td></tr>`
    : '';
  const discountLine = discount && discount > 0
    ? `<tr><td style="color:#166534;">Discount</td><td style="color:#166534;">-${fmt(discount)}</td></tr>`
    : '';

  const siteBase = siteBaseUrl || process.env.SITE_URL || `https://${SITE_DOMAIN}`;

  const specTableCss = `
    .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
    .ref-box p { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; word-break: break-word; }
    td:first-child { color: #6b7280; width: 42%; }
    .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; color: ${BRAND_DARK}; }
    .total-row td:last-child { color: ${BRAND_GREEN}; }
    .note-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    @media screen and (max-width: 600px) {
      td { padding: 7px 5px !important; }
      td:first-child { width: 44% !important; }
    }
  `;

  const financeBlock = (fi: typeof financeInfo) => fi ? `
    <h4 style="margin:12px 0 6px; color:#374151; font-size:13px;">Finance Option (HP — 10.9% APR)</h4>
    <table>
      <tr><td>Deposit</td><td>${fmt(fi.depositAmount)}</td></tr>
      <tr><td>Finance Term</td><td>${fi.termMonths} months${fi.termMonths % 12 === 0 ? ` (${fi.termMonths / 12} year${fi.termMonths / 12 !== 1 ? 's' : ''})` : ''}</td></tr>
      <tr><td>Monthly Payment (est.)</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(fi.monthlyPayment)}/month</td></tr>
      <tr><td>Weekly Payment (est.)</td><td>${fmt(fi.weeklyPayment)}/week</td></tr>
    </table>
    <p style="font-size:11px; color:#6b7280; margin-top:-8px;">Estimates based on Hire Purchase at 10.9% APR. Subject to status and final agreement.</p>
  ` : '';

  // ── COMPARISON MODE ──────────────────────────────────────────────────────────
  if (isComparison && comparisonSlotB) {
    const slotB = comparisonSlotB;
    const chosenBadge = (opt: 'A' | 'B') =>
      chosenOption === opt
        ? ` <span style="background:${BRAND_GREEN};color:${BRAND_DARK};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:bold;vertical-align:middle;">CHOSEN</span>`
        : '';

    const optionBlock = (opt: 'A' | 'B', oVanTitle: string | null | undefined, oKitName: string | null | undefined, oUpgradeNames: string[] | undefined, oSubtotal: number, oVAT: number, oTotal: number, oFinance: typeof financeInfo) => {
      const isChosen = chosenOption === opt;
      const borderStyle = isChosen ? `border:2px solid ${BRAND_GREEN};` : 'border:1px solid #e5e7eb;';
      const chooseBtn = !chosenOption && chooseOptionToken
        ? `<div style="text-align:center; margin-top:16px;">
            <a href="${siteBase}/api/quotes/${quoteId}/choose-option?option=${opt}&token=${chooseOptionToken}"
               style="display:block;max-width:240px;margin:0 auto;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:bold;font-size:15px;padding:13px 24px;border-radius:4px;text-decoration:none;text-align:center;box-sizing:border-box;">
              I choose Option ${opt}
            </a>
          </div>`
        : '';
      return `
        <div style="${borderStyle} border-radius:6px; padding:20px; margin-bottom:20px; background:#fff;">
          <p style="font-weight:bold; font-size:15px; margin:0 0 12px; color:${BRAND_DARK};">
            Option ${opt}${chosenBadge(opt)}
          </p>
          <table>
            ${oVanTitle ? `<tr><td>Van</td><td>${oVanTitle}</td></tr>` : ''}
            ${oKitName ? `<tr><td>Pack</td><td>${oKitName}</td></tr>` : ''}
            ${oUpgradeNames && oUpgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${oUpgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
            ${extrasHtmlRow}
            <tr><td>Subtotal (ex. VAT)</td><td>${fmt(oSubtotal)}</td></tr>
            <tr><td>VAT (20%)</td><td>${fmt(oVAT)}</td></tr>
            <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(oTotal)}</td></tr>
          </table>
          ${financeBlock(oFinance)}
          ${chooseBtn}
        </div>`;
    };

    const introText = chosenOption
      ? `You have selected <strong>Option ${chosenOption}</strong> as your final choice. Our team will be in touch shortly to confirm next steps.`
      : `We've prepared two options for you to compare. Please review both below and click the button under the one you'd like to go ahead with — we'll be notified straight away.`;

    const chosenConfirmBlock = chosenOption ? `
      <div style="margin:24px 0; padding:20px; background:#f0fdf4; border:2px solid ${BRAND_GREEN}; border-radius:6px; text-align:center;">
        <p style="font-size:16px; font-weight:bold; color:#166534; margin:0 0 6px;">Option ${chosenOption} selected</p>
        <p style="font-size:13px; color:#166534; margin:0;">Our team will be in touch to confirm your order. Call us on <strong>${PHONE}</strong> if you have any questions.</p>
      </div>` : '';

    const compBodyHtml = `
      <p>Hi ${customerName},</p>
      <p>${introText}</p>
      <div class="ref-box">
        <p><strong>Reference:</strong> #${ref}</p>
        <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
      </div>
      ${chosenConfirmBlock}
      ${optionBlock('A', vanTitle, kitName, upgradeNames, subtotal, vat, totalAfterDiscount, financeInfo ?? null)}
      ${optionBlock('B', slotB.vanTitle, slotB.kitName, slotB.upgradeNames, slotB.estSubtotal ?? 0, slotB.estVAT ?? 0, slotB.estTotal ?? 0, slotB.financeInfo ?? null)}
      ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
      <p>If you have any questions, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
      <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
    `;

    const tokenSuffix = chooseOptionToken ? `&token=${chooseOptionToken}` : '';
    const textBody = `Hi ${customerName},\n\n${chosenOption ? `You have selected Option ${chosenOption}.` : 'We have prepared two options for you to compare. Please choose the one you prefer using the links below.'}\n\nReference: #${ref}\n\nOPTION A\n${vanTitle ? `Van: ${vanTitle}\n` : ''}${kitName ? `Pack: ${kitName}\n` : ''}${upgradeNames && upgradeNames.length > 0 ? `Upgrades:\n${upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${extrasTextBlock}Subtotal: ${fmt(subtotal)}\nVAT: ${fmt(vat)}\nTotal: ${fmt(totalAfterDiscount)}\n${!chosenOption && chooseOptionToken ? `\nChoose Option A: ${siteBase}/api/quotes/${quoteId}/choose-option?option=A${tokenSuffix}\n` : ''}\nOPTION B\n${slotB.vanTitle ? `Van: ${slotB.vanTitle}\n` : ''}${slotB.kitName ? `Pack: ${slotB.kitName}\n` : ''}${slotB.upgradeNames && slotB.upgradeNames.length > 0 ? `Upgrades:\n${slotB.upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${extrasTextBlock}${slotB.estSubtotal != null ? `Subtotal: ${fmt(slotB.estSubtotal)}\n` : ''}${slotB.estVAT != null ? `VAT: ${fmt(slotB.estVAT)}\n` : ''}${slotB.estTotal != null ? `Total: ${fmt(slotB.estTotal)}\n` : ''}${!chosenOption && chooseOptionToken ? `\nChoose Option B: ${siteBase}/api/quotes/${quoteId}/choose-option?option=B${tokenSuffix}\n` : ''}\n${customerNote ? `\nNote from our team: ${customerNote}\n` : ''}\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`;

    await sendOrThrow(client, {
      to,
      from: fromEmail,
      subject: `Your Van Conversion Options – Ref #${ref} – ${BRAND_NAME}`,
      html: emailLayout(compBodyHtml, {
        extraCss: specTableCss,
        footerNote: 'If you did not request this summary, please disregard this email.',
      }),
      text: textBody,
    });
    return;
  }

  // ── SINGLE-VAN MODE ──────────────────────────────────────────────────────────
  const financeBlockSingle = financeInfo ? `
    <h3 style="margin-bottom:8px; margin-top:24px;">Finance Option (HP — 10.9% APR)</h3>
    <table>
      <tr><td>Deposit</td><td>${fmt(financeInfo.depositAmount)}</td></tr>
      <tr><td>Finance Term</td><td>${financeInfo.termMonths} months${financeInfo.termMonths % 12 === 0 ? ` (${financeInfo.termMonths / 12} year${financeInfo.termMonths / 12 !== 1 ? 's' : ''})` : ''}</td></tr>
      <tr><td>Estimated Monthly Payment</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(financeInfo.monthlyPayment)}/month</td></tr>
      <tr><td>Estimated Weekly Payment</td><td>${fmt(financeInfo.weeklyPayment)}/week (approx.)</td></tr>
    </table>
    <p style="font-size:12px; color:#6b7280; margin-top:-8px;">Finance figures are estimates based on Hire Purchase at 10.9% APR. Subject to status and final agreement.</p>
  ` : '';

  const financeText = financeInfo ? `\nFinance Option (HP — 10.9% APR)\nDeposit: ${fmt(financeInfo.depositAmount)}\nTerm: ${financeInfo.termMonths} months\nMonthly payment: ${fmt(financeInfo.monthlyPayment)}\nWeekly payment (approx.): ${fmt(financeInfo.weeklyPayment)}\n` : '';

  const approvalBlock = approvalToken ? `
    <div style="margin: 28px 0; padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center;">
      <p style="font-size: 15px; font-weight: bold; margin: 0 0 6px;">Does this look correct?</p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">Please let us know whether the spec above is right, or if anything needs changing.</p>
      <a href="${siteBase}/spec-approval/${approvalToken}?status=approved"
         style="display:block; max-width:280px; margin:0 auto 12px; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; text-align:center; box-sizing:border-box;">
        This looks correct
      </a>
      <a href="${siteBase}/spec-approval/${approvalToken}?status=rejected"
         style="display:block; max-width:280px; margin:0 auto; background:#fff; color:#374151; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; border:1px solid #d1d5db; text-align:center; box-sizing:border-box;">
        Something needs changing
      </a>
    </div>
  ` : '';

  const singleBodyHtml = `
    <p>Hi ${customerName},</p>
    <p>Thank you for speaking with us today. As discussed, please find below a summary of your configured mobile tyre van conversion.</p>
    <div class="ref-box">
      <p><strong>Reference:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    <h3 style="margin-bottom:8px;">Your Configuration</h3>
    <table>
      ${vanTitle ? `<tr><td>Van</td><td>${vanTitle}</td></tr>` : ''}
      ${kitName ? `<tr><td>Pack</td><td>${kitName}</td></tr>` : ''}
      ${upgradeNames && upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${extrasHtmlRow}
    </table>
    <h3 style="margin-bottom:8px;">Pricing</h3>
    <table>
      ${originalPriceLine}
      ${discountLine}
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(totalAfterDiscount)}</td></tr>
    </table>
    ${financeBlockSingle}
    ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
    ${approvalBlock}
    <p>If you have any questions or would like to make changes, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to,
    from: fromEmail,
    subject: `Your Van Conversion Summary – Ref #${ref} – ${BRAND_NAME}`,
    html: emailLayout(singleBodyHtml, {
      extraCss: specTableCss,
      footerNote: 'If you did not request this summary, please disregard this email.',
    }),
    text: `Hi ${customerName},\n\nThank you for speaking with us today. As discussed, please find below a summary of your configured mobile tyre van conversion.\n\nReference: #${ref}\n${vanTitle ? `Van: ${vanTitle}\n` : ''}${kitName ? `Pack: ${kitName}\n` : ''}${upgradeNames && upgradeNames.length > 0 ? `Upgrades:\n${upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${extrasTextBlock}Subtotal (ex. VAT): ${fmt(subtotal)}\nVAT (20%): ${fmt(vat)}\n${discount && discount > 0 ? `Discount: -${fmt(discount)}\n` : ''}Total (inc. VAT): ${fmt(totalAfterDiscount)}\n${financeText}${customerNote ? `\nNote from our team: ${customerNote}\n` : ''}${approvalToken ? `\nSpec approval: ${siteBase}/spec-approval/${approvalToken}\n` : ''}\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── Finance submission email: sent to finance company by admin ────────────────
export async function sendFinanceSubmissionEmail({
  financeCompanyEmail,
  customerName,
  customerPhone,
  customerEmail,
  quoteId,
  vanTitle,
  vanRegistration,
  vanMileage,
  kitName,
  kitPrice,
  upgrades,
  upgradeNames,
  subtotal,
  vat,
  total,
  discount,
  customExtras = [],
  financeDetails,
}: {
  financeCompanyEmail: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  quoteId: string;
  vanTitle?: string | null;
  vanRegistration?: string | null;
  vanMileage?: number | null;
  kitName?: string | null;
  kitPrice?: number | null;
  upgrades?: Array<{ name: string; price: number }>;
  upgradeNames?: string[];
  subtotal: number;
  vat: number;
  total: number;
  discount?: number;
  customExtras?: Array<{ id: string; description: string; pricePence: number }>;
  financeDetails?: {
    planType: string;
    apr: number;
    depositAmount: number;
    termMonths: number;
    monthlyPayment: number;
    weeklyPayment: number;
  };
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const ref = quoteId.slice(0, 8).toUpperCase();

  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const totalAfterDiscount = discount && discount > 0 ? total - discount : total;
  const originalPriceLine = discount && discount > 0
    ? `<tr><td>Original Price (inc. VAT)</td><td>${fmt(total)}</td></tr>`
    : '';
  const discountLine = discount && discount > 0
    ? `<tr><td style="color:#166534;">Discount</td><td style="color:#166534;">-${fmt(discount)}</td></tr>`
    : '';

  const finBodyHtml = `
    <p>Please find below the details for a finance application from one of our customers who would like to proceed with a van conversion.</p>

    <div class="section-title">Customer Details</div>
    <table>
      <tr><td>Name</td><td>${customerName}</td></tr>
      <tr><td>Phone</td><td>${customerPhone}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
      <tr><td>Reference</td><td><span class="ref-pill">#${ref}</span></td></tr>
    </table>

    <div class="section-title">Vehicle Details</div>
    <table>
      ${vanTitle ? `<tr><td>Van</td><td>${vanTitle}</td></tr>` : ''}
      ${vanRegistration ? `<tr><td>Registration</td><td><strong>${vanRegistration.toUpperCase()}</strong></td></tr>` : ''}
      ${vanMileage !== undefined && vanMileage !== null ? `<tr><td>Mileage</td><td>${vanMileage.toLocaleString('en-GB')} miles</td></tr>` : ''}
    </table>

    <div class="section-title">Conversion Specification (ex. VAT)</div>
    <table>
      ${(() => {
        const effectiveUpgrades = upgrades ?? (upgradeNames ? upgradeNames.map(n => ({ name: n, price: 0 })) : []);
        const rows: string[] = [];
        if (kitName) {
          const kitPriceStr = kitPrice != null ? `<span style="float:right;font-weight:600;">${fmt(kitPrice)}</span>` : '';
          rows.push(`<tr><td style="color:#111;font-weight:500;">Equipment Pack</td><td>${kitName}${kitPriceStr}</td></tr>`);
        }
        for (const u of effectiveUpgrades) {
          const priceStr = u.price > 0 ? `<span style="float:right;font-weight:600;">${fmt(u.price)}</span>` : '';
          rows.push(`<tr><td style="color:#111;font-weight:500;">Upgrade</td><td>${u.name}${priceStr}</td></tr>`);
        }
        for (const e of (customExtras || [])) {
          rows.push(`<tr><td style="color:#111;font-weight:500;">Bespoke Extra</td><td>${e.description}<span style="float:right;font-weight:600;">${fmt(e.pricePence)}</span></td></tr>`);
        }
        return rows.join('');
      })()}
    </table>

    <div class="section-title">Pricing</div>
    <table>
      ${originalPriceLine}
      ${discountLine}
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(totalAfterDiscount)}</td></tr>
    </table>

    ${financeDetails ? `
    <div class="section-title">Finance Details</div>
    <table>
      <tr><td>Plan Type</td><td>${financeDetails.planType}</td></tr>
      <tr><td>APR</td><td>${financeDetails.apr.toFixed(2)}%</td></tr>
      <tr><td>Deposit</td><td>${fmt(financeDetails.depositAmount)}</td></tr>
      <tr><td>Term</td><td>${financeDetails.termMonths} months</td></tr>
      <tr><td>Monthly Payment</td><td>${fmt(financeDetails.monthlyPayment)}</td></tr>
      <tr><td>Weekly Payment</td><td>${fmt(financeDetails.weeklyPayment)}</td></tr>
    </table>
    ` : ''}

    <p style="margin-top:24px;">Please contact the customer directly to progress the finance application. If you have any questions, please reply to this email or call us on <strong>${PHONE}</strong>.</p>
    <p>Kind regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  const financeText = financeDetails ? `\nFinance Details:\nPlan Type: ${financeDetails.planType}\nAPR: ${financeDetails.apr.toFixed(2)}%\nDeposit: ${fmt(financeDetails.depositAmount)}\nTerm: ${financeDetails.termMonths} months\nMonthly Payment: ${fmt(financeDetails.monthlyPayment)}\nWeekly Payment: ${fmt(financeDetails.weeklyPayment)}\n` : '';
  const effectiveUpgradesText = upgrades ?? (upgradeNames ? upgradeNames.map(n => ({ name: n, price: 0 })) : []);
  const specLines: string[] = [];
  if (kitName) specLines.push(`  - Equipment Pack: ${kitName}${kitPrice != null ? ` (${fmt(kitPrice)} ex. VAT)` : ''}`);
  for (const u of effectiveUpgradesText) specLines.push(`  - Upgrade: ${u.name}${u.price > 0 ? ` (${fmt(u.price)} ex. VAT)` : ''}`);
  for (const e of (customExtras || [])) specLines.push(`  - Bespoke Extra: ${e.description} (${fmt(e.pricePence)} ex. VAT)`);
  const specText = specLines.length > 0 ? `Conversion Specification (ex. VAT):\n${specLines.join('\n')}\n` : '';
  const emailText = `Finance Application – Ref #${ref}\n\nCustomer Details:\nName: ${customerName}\nPhone: ${customerPhone}\nEmail: ${customerEmail}\n\nVehicle Details:\n${vanTitle ? `Van: ${vanTitle}\n` : ''}${vanRegistration ? `Registration: ${vanRegistration.toUpperCase()}\n` : ''}${vanMileage !== undefined && vanMileage !== null ? `Mileage: ${vanMileage.toLocaleString('en-GB')} miles\n` : ''}\n${specText}\nPricing:\n${discount && discount > 0 ? `Original Price (inc. VAT): ${fmt(total)}\nDiscount: -${fmt(discount)}\n` : ''}Subtotal (ex. VAT): ${fmt(subtotal)}\nVAT (20%): ${fmt(vat)}\nTotal (inc. VAT): ${fmt(totalAfterDiscount)}\n${financeText}\n${BRAND_NAME} | ${PHONE}\n${ADDRESS}`;

  await sendOrThrow(client, {
    to: financeCompanyEmail,
    ...(FALLBACK_RECIPIENT ? { cc: [FALLBACK_RECIPIENT] } : {}),
    from: fromEmail,
    replyTo: [fromEmail],
    subject: `Finance Application – ${customerName} – ${fmt(totalAfterDiscount)} – Ref #${ref}`,
    html: emailLayout(finBodyHtml, {
      maxWidth: 650,
      extraCss: `
        .section-title { font-size: 14px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid ${BRAND_GREEN}; padding-bottom: 6px; margin: 24px 0 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
        td:first-child { color: #6b7280; width: 40%; font-weight: 500; }
        .total-row td { font-weight: bold; font-size: 17px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
        .total-row td:last-child { color: ${BRAND_GREEN}; }
        .ref-pill { display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 12px; font-family: monospace; font-size: 14px; font-weight: bold; }
        @media screen and (max-width: 600px) {
          td { padding: 8px 6px !important; }
          td:first-child { width: 45% !important; }
        }
      `,
    }),
    text: emailText,
  });
}

// ── Enquiry received: customer confirmation + admin notification ───────────────
export async function sendQuoteReceivedEmails({
  quote,
  vanTitle,
  kitName,
  upgradeNames,
  customExtras = [],
  comparisonSlotB,
  financeInfoA,
  financeInfoB,
  chosenOption,
  baseUrl,
  testMode,
  chooseOptionToken,
}: {
  quote: {
    id: string;
    userName: string;
    email: string;
    phone: string;
    company?: string | null;
    estTotal: number;
    estSubtotal: number;
    estVAT: number;
    estDiscount?: number | null;
  };
  vanTitle?: string | null;
  kitName?: string | null;
  upgradeNames?: string[];
  customExtras?: Array<{ id: string; description: string; pricePence: number }>;
  comparisonSlotB?: {
    vanTitle?: string | null;
    kitName?: string | null;
    upgradeNames?: string[];
    estSubtotal?: number;
    estVAT?: number;
    estTotal?: number;
  } | null;
  financeInfoA?: {
    depositAmount: number;
    termMonths: number;
    monthlyPayment: number;
    weeklyPayment: number;
  };
  financeInfoB?: {
    depositAmount: number;
    termMonths: number;
    monthlyPayment: number;
    weeklyPayment: number;
  };
  chosenOption?: 'A' | 'B' | null;
  baseUrl?: string;
  testMode?: { variant: 'customer' | 'admin'; testAddress: string };
  chooseOptionToken?: string;
}) {
  // Never send real emails for test/e2e submissions
  if (isTestEmail(quote.email)) {
    console.log(`[E2E] Suppressing all emails for test address: ${quote.email}`);
    return;
  }

  const { client, fromEmail } = await getUncachableResendClient();

  const ref = quote.id.slice(0, 8).toUpperCase();
  const discountAmountPence = quote.estDiscount || 0;
  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const total = fmt(quote.estTotal);
  const subtotal = fmt(quote.estSubtotal);
  const vat = fmt(quote.estVAT);
  const originalTotal = discountAmountPence > 0 ? fmt(quote.estTotal + discountAmountPence) : null;
  const discountFmt = discountAmountPence > 0 ? fmt(discountAmountPence) : null;

  const qrExtrasHtmlRow = customExtras && customExtras.length > 0
    ? `<tr><td>Bespoke Extras</td><td><ul style="margin:2px 0;padding-left:18px;">${customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} — £${(e.pricePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</li>`).join('')}</ul></td></tr>`
    : '';
  const qrExtrasTextBlock = customExtras && customExtras.length > 0
    ? `Bespoke Extras:\n${customExtras.map(e => `  - ${e.description} (£${(e.pricePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })})`).join('\n')}\n`
    : '';

  const summaryTableCss = `
    .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
    .ref-box p { margin: 0; }
    .summary { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .summary td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
    .summary td:first-child { color: #6b7280; width: 40%; }
    .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
    @media screen and (max-width: 600px) {
      .summary td { padding: 8px 6px !important; }
      .summary td:first-child { width: 42% !important; }
    }
  `;

  // 1. Customer confirmation
  const custBodyHtml = `
    <p>Hi ${quote.userName},</p>
    <p>Thank you for completing our van configurator. We've received your enquiry and one of our team will be in touch within 24 hours to discuss your requirements.</p>
    <div class="ref-box">
      <p><strong>Your reference number:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    <h3 style="margin-bottom: 8px;">Your Configuration Summary</h3>
    ${comparisonSlotB ? `<p style="font-size:13px;color:#6b7280;margin-bottom:8px;">You submitted two options for our team to compare. Both are shown below.${chosenOption ? ` <strong>Option ${chosenOption}</strong> has been selected as your final choice.` : " If you already know which option you prefer, you can select it using the button below each option and we'll be notified straight away."}</p>` : ''}
    ${comparisonSlotB
      ? `<p style="font-weight:bold;font-size:14px;margin-bottom:4px;color:${BRAND_DARK};">Option A${chosenOption === 'A' ? ' <span style="background:${BRAND_GREEN};color:${BRAND_DARK};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:bold;vertical-align:middle;">CHOSEN</span>' : ''}</p>`
      : ''}
    <table class="summary" style="${comparisonSlotB && chosenOption === 'A' ? 'border:2px solid ${BRAND_GREEN};border-radius:4px;' : ''}">
      ${vanTitle ? `<tr><td>Van</td><td>${vanTitle}</td></tr>` : ''}
      ${kitName ? `<tr><td>Pack</td><td>${kitName}</td></tr>` : ''}
      ${upgradeNames && upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${qrExtrasHtmlRow}
      <tr><td>Subtotal</td><td>${subtotal}</td></tr>
      <tr><td>VAT (20%)</td><td>${vat}</td></tr>
      ${originalTotal ? `<tr><td style="color:#6b7280;">Before discount</td><td style="color:#6b7280;text-decoration:line-through;">${originalTotal}</td></tr>` : ''}
      ${discountFmt ? `<tr><td style="color:#166534;font-weight:bold;">Discount</td><td style="color:#166534;font-weight:bold;">-${discountFmt}</td></tr>` : ''}
      <tr class="total-row"><td>Total${discountAmountPence > 0 ? ' (after discount)' : ''}</td><td>${total}</td></tr>
      ${financeInfoA ? `
      <tr><td colspan="2" style="padding-top:12px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
      <tr><td style="color:#6b7280;">Deposit</td><td>£${(financeInfoA.depositAmount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td style="color:#6b7280;">Term</td><td>${financeInfoA.termMonths} months${financeInfoA.termMonths % 12 === 0 ? ` (${financeInfoA.termMonths / 12} yr${financeInfoA.termMonths / 12 !== 1 ? 's' : ''})` : ''}</td></tr>
      <tr><td style="color:#6b7280;">Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">£${(financeInfoA.monthlyPayment / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}/month</td></tr>
      <tr><td style="color:#6b7280;">Est. Weekly</td><td>£${(financeInfoA.weeklyPayment / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}/week (approx.)</td></tr>
      ` : ''}
    </table>
    ${comparisonSlotB && !chosenOption && baseUrl && chooseOptionToken ? `
    <div style="text-align:center;margin:12px 0 24px;">
      <a href="${baseUrl}/api/quotes/${quote.id}/choose-option?option=A&token=${chooseOptionToken}" style="display:block;max-width:260px;margin:0 auto;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:bold;font-size:15px;padding:14px 28px;border-radius:4px;text-decoration:none;text-align:center;box-sizing:border-box;">I choose Option A</a>
    </div>` : ''}
    ${comparisonSlotB ? `
    <p style="font-weight:bold;font-size:14px;margin-top:20px;margin-bottom:4px;color:${BRAND_DARK};">Option B${chosenOption === 'B' ? ' <span style="background:${BRAND_GREEN};color:${BRAND_DARK};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:bold;vertical-align:middle;">CHOSEN</span>' : ''}</p>
    <table class="summary" style="${chosenOption === 'B' ? 'border:2px solid ${BRAND_GREEN};border-radius:4px;' : ''}">
      ${comparisonSlotB.vanTitle ? `<tr><td>Van</td><td>${comparisonSlotB.vanTitle}</td></tr>` : ''}
      ${comparisonSlotB.kitName ? `<tr><td>Pack</td><td>${comparisonSlotB.kitName}</td></tr>` : ''}
      ${comparisonSlotB.upgradeNames && comparisonSlotB.upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${comparisonSlotB.upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${qrExtrasHtmlRow}
      ${comparisonSlotB.estSubtotal != null ? `<tr><td>Subtotal</td><td>£${(comparisonSlotB.estSubtotal / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${comparisonSlotB.estVAT != null ? `<tr><td>VAT (20%)</td><td>£${(comparisonSlotB.estVAT / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${comparisonSlotB.estTotal != null ? `<tr class="total-row"><td>Total</td><td>£${(comparisonSlotB.estTotal / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      ${financeInfoB ? `
      <tr><td colspan="2" style="padding-top:12px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
      <tr><td style="color:#6b7280;">Deposit</td><td>£${(financeInfoB.depositAmount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td style="color:#6b7280;">Term</td><td>${financeInfoB.termMonths} months${financeInfoB.termMonths % 12 === 0 ? ` (${financeInfoB.termMonths / 12} yr${financeInfoB.termMonths / 12 !== 1 ? 's' : ''})` : ''}</td></tr>
      <tr><td style="color:#6b7280;">Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">£${(financeInfoB.monthlyPayment / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}/month</td></tr>
      <tr><td style="color:#6b7280;">Est. Weekly</td><td>£${(financeInfoB.weeklyPayment / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}/week (approx.)</td></tr>
      ` : ''}
    </table>
    ${!chosenOption && baseUrl && chooseOptionToken ? `
    <div style="text-align:center;margin:12px 0 24px;">
      <a href="${baseUrl}/api/quotes/${quote.id}/choose-option?option=B&token=${chooseOptionToken}" style="display:block;max-width:260px;margin:0 auto;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:bold;font-size:15px;padding:14px 28px;border-radius:4px;text-decoration:none;text-align:center;box-sizing:border-box;">I choose Option B</a>
    </div>` : ''}
    ` : ''}
    <p>If you have any questions in the meantime, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  if (!testMode || testMode.variant === 'customer') {
    await sendOrThrow(client, {
      to: quote.email,
      from: fromEmail,
      subject: `We've received your enquiry – Ref #${ref}`,
      html: emailLayout(custBodyHtml, {
        extraCss: summaryTableCss,
        footerNote: 'If you did not submit this enquiry, please disregard this email.',
      }),
      text: `Hi ${quote.userName},\n\nThank you for completing our van configurator. We've received your enquiry and will be in touch within 24 hours.\n\nReference: #${ref}\n${comparisonSlotB ? `\nOPTION A\n` : ''}${vanTitle ? `Van: ${vanTitle}\n` : ''}${kitName ? `Pack: ${kitName}\n` : ''}${upgradeNames && upgradeNames.length > 0 ? `Upgrades:\n${upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${qrExtrasTextBlock}Subtotal: ${subtotal}\nVAT: ${vat}\n${discountFmt ? `Before discount: ${originalTotal}\nDiscount: -${discountFmt}\n` : ''}Total${discountAmountPence > 0 ? ' (after discount)' : ''}: ${total}\n${financeInfoA ? `Finance (10.9% APR): £${(financeInfoA.monthlyPayment/100).toFixed(2)}/month, £${(financeInfoA.weeklyPayment/100).toFixed(2)}/week (${financeInfoA.termMonths} months, £${(financeInfoA.depositAmount/100).toFixed(0)} deposit)\n` : ''}${comparisonSlotB ? `\nOPTION B\n${comparisonSlotB.vanTitle ? `Van: ${comparisonSlotB.vanTitle}\n` : ''}${comparisonSlotB.kitName ? `Pack: ${comparisonSlotB.kitName}\n` : ''}${qrExtrasTextBlock}${comparisonSlotB.estSubtotal != null ? `Subtotal: £${(comparisonSlotB.estSubtotal/100).toFixed(2)}\n` : ''}${comparisonSlotB.estVAT != null ? `VAT: £${(comparisonSlotB.estVAT/100).toFixed(2)}\n` : ''}${comparisonSlotB.estTotal != null ? `Total: £${(comparisonSlotB.estTotal/100).toFixed(2)}\n` : ''}${financeInfoB ? `Finance (10.9% APR): £${(financeInfoB.monthlyPayment/100).toFixed(2)}/month, £${(financeInfoB.weeklyPayment/100).toFixed(2)}/week (${financeInfoB.termMonths} months, £${(financeInfoB.depositAmount/100).toFixed(0)} deposit)\n` : ''}` : ''}\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`,
    });
  }

  // 2. Admin notification
  const adminFinanceRowsA = financeInfoA ? `
    <tr><td colspan="2" style="padding-top:10px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
    <tr><td>Deposit</td><td>£${(financeInfoA.depositAmount/100).toLocaleString('en-GB',{minimumFractionDigits:2})}</td></tr>
    <tr><td>Term</td><td>${financeInfoA.termMonths} months${financeInfoA.termMonths%12===0?` (${financeInfoA.termMonths/12} yr${financeInfoA.termMonths/12!==1?'s':''})`:''}  </td></tr>
    <tr><td>Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">£${(financeInfoA.monthlyPayment/100).toLocaleString('en-GB',{minimumFractionDigits:2})}/month</td></tr>
    <tr><td>Est. Weekly</td><td>£${(financeInfoA.weeklyPayment/100).toLocaleString('en-GB',{minimumFractionDigits:2})}/week (approx.)</td></tr>
  ` : '';
  const adminFinanceRowsB = financeInfoB ? `
    <tr><td colspan="2" style="padding-top:10px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
    <tr><td>Deposit</td><td>£${(financeInfoB.depositAmount/100).toLocaleString('en-GB',{minimumFractionDigits:2})}</td></tr>
    <tr><td>Term</td><td>${financeInfoB.termMonths} months${financeInfoB.termMonths%12===0?` (${financeInfoB.termMonths/12} yr${financeInfoB.termMonths/12!==1?'s':''})`:''}  </td></tr>
    <tr><td>Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">£${(financeInfoB.monthlyPayment/100).toLocaleString('en-GB',{minimumFractionDigits:2})}/month</td></tr>
    <tr><td>Est. Weekly</td><td>£${(financeInfoB.weeklyPayment/100).toLocaleString('en-GB',{minimumFractionDigits:2})}/week (approx.)</td></tr>
  ` : '';

  const adminBodyHtml = `
    <h2 style="color:${BRAND_DARK}; border-bottom: 3px solid ${BRAND_GREEN}; padding-bottom: 8px;">New Configurator Submission</h2>
    <h3>Customer Details</h3>
    <table>
      <tr><td>Name</td><td>${quote.userName}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${quote.email}">${quote.email}</a></td></tr>
      <tr><td>Phone</td><td>${quote.phone}</td></tr>
      ${quote.company ? `<tr><td>Company</td><td>${quote.company}</td></tr>` : ''}
      <tr><td>Reference</td><td>#${ref}</td></tr>
    </table>
    <h3>${comparisonSlotB ? 'Option A — ' : ''}Configuration</h3>
    <table>
      ${vanTitle ? `<tr><td>Van</td><td>${vanTitle}</td></tr>` : ''}
      ${kitName ? `<tr><td>Pack</td><td>${kitName}</td></tr>` : ''}
      ${upgradeNames && upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${qrExtrasHtmlRow}
    </table>
    <h3>${comparisonSlotB ? 'Option A — ' : ''}Pricing</h3>
    <table>
      <tr><td>Subtotal (ex. VAT)</td><td>${subtotal}</td></tr>
      <tr><td>VAT (20%)</td><td>${vat}</td></tr>
      ${discountFmt ? `<tr><td style="color:#166534;">Discount</td><td style="color:#166534;">-${discountFmt}</td></tr>` : ''}
      <tr class="total"><td>Total (inc. VAT)</td><td>${total}</td></tr>
      ${adminFinanceRowsA}
    </table>
    ${comparisonSlotB ? `
    <h3>Option B — Configuration</h3>
    <table>
      ${comparisonSlotB.vanTitle ? `<tr><td>Van</td><td>${comparisonSlotB.vanTitle}</td></tr>` : ''}
      ${comparisonSlotB.kitName ? `<tr><td>Pack</td><td>${comparisonSlotB.kitName}</td></tr>` : ''}
      ${comparisonSlotB.upgradeNames && comparisonSlotB.upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${comparisonSlotB.upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${qrExtrasHtmlRow}
    </table>
    <h3>Option B — Pricing</h3>
    <table>
      ${comparisonSlotB.estSubtotal != null ? `<tr><td>Subtotal (ex. VAT)</td><td>£${(comparisonSlotB.estSubtotal/100).toLocaleString('en-GB',{minimumFractionDigits:2})}</td></tr>` : ''}
      ${comparisonSlotB.estVAT != null ? `<tr><td>VAT (20%)</td><td>£${(comparisonSlotB.estVAT/100).toLocaleString('en-GB',{minimumFractionDigits:2})}</td></tr>` : ''}
      ${comparisonSlotB.estTotal != null ? `<tr class="total"><td>Total (inc. VAT)</td><td>£${(comparisonSlotB.estTotal/100).toLocaleString('en-GB',{minimumFractionDigits:2})}</td></tr>` : ''}
      ${adminFinanceRowsB}
    </table>
    ` : ''}
  `;

  const adminText = `New configurator submission\n\nName: ${quote.userName}\nEmail: ${quote.email}\nPhone: ${quote.phone}\n${quote.company ? `Company: ${quote.company}\n` : ''}Reference: #${ref}\n\n${comparisonSlotB ? 'OPTION A\n' : ''}${vanTitle ? `Van: ${vanTitle}\n` : ''}${kitName ? `Pack: ${kitName}\n` : ''}${upgradeNames && upgradeNames.length > 0 ? `Upgrades:\n${upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${qrExtrasTextBlock}Subtotal: ${subtotal}\nVAT: ${vat}\n${discountFmt ? `Discount: -${discountFmt}\n` : ''}Total: ${total}${financeInfoA ? `\nFinance (10.9% APR): £${(financeInfoA.monthlyPayment/100).toFixed(2)}/month, £${(financeInfoA.weeklyPayment/100).toFixed(2)}/week (${financeInfoA.termMonths} months, £${(financeInfoA.depositAmount/100).toFixed(0)} deposit)` : ''}${comparisonSlotB ? `\n\nOPTION B\n${comparisonSlotB.vanTitle ? `Van: ${comparisonSlotB.vanTitle}\n` : ''}${comparisonSlotB.kitName ? `Pack: ${comparisonSlotB.kitName}\n` : ''}${comparisonSlotB.upgradeNames && comparisonSlotB.upgradeNames.length > 0 ? `Upgrades:\n${comparisonSlotB.upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${qrExtrasTextBlock}${comparisonSlotB.estSubtotal != null ? `Subtotal: £${(comparisonSlotB.estSubtotal/100).toFixed(2)}\n` : ''}${comparisonSlotB.estVAT != null ? `VAT: £${(comparisonSlotB.estVAT/100).toFixed(2)}\n` : ''}${comparisonSlotB.estTotal != null ? `Total: £${(comparisonSlotB.estTotal/100).toFixed(2)}` : ''}${financeInfoB ? `\nFinance (10.9% APR): £${(financeInfoB.monthlyPayment/100).toFixed(2)}/month, £${(financeInfoB.weeklyPayment/100).toFixed(2)}/week (${financeInfoB.termMonths} months, £${(financeInfoB.depositAmount/100).toFixed(0)} deposit)` : ''}` : ''}`;

  if (!testMode || testMode.variant === 'admin') {
    await sendOrThrow(client, {
      to: testMode ? testMode.testAddress : await getInternalNotifyEmails('configurator_submission'),
      from: fromEmail,
      subject: `New configurator submission – ${quote.userName} – ${total} – Ref #${ref}`,
      html: emailLayout(adminBodyHtml, {
        extraCss: `
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
          td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
          .total td { font-weight: bold; font-size: 16px; border-top: 2px solid ${BRAND_GREEN}; }
          @media screen and (max-width: 600px) {
            td { padding: 8px 6px !important; }
            td:first-child { width: 40% !important; }
          }
        `,
      }),
      text: adminText,
    });
  }
}

// ── Option chosen admin notification ─────────────────────────────────────────
export async function sendOptionChosenAdminNotification({
  quoteId,
  customerName,
  customerEmail,
  customerPhone,
  chosenOption,
  optionDetails,
  toOverride,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  chosenOption: 'A' | 'B';
  optionDetails: {
    vanTitle?: string | null;
    kitName?: string | null;
    upgradeNames?: string[];
    estTotal?: number;
  };
  toOverride?: string | string[];
}) {
  const { client, fromEmail } = await getUncachableResendClient();

  const ref = quoteId.slice(0, 8).toUpperCase();
  const totalStr = optionDetails.estTotal != null
    ? `£${(optionDetails.estTotal / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
    : null;

  const bodyHtml = `
    <div style="display:inline-block; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:13px; padding:4px 14px; border-radius:4px; margin-bottom:16px;">Option ${chosenOption} Selected</div>
    <h3 style="margin-top:0;">Customer Details</h3>
    <table>
      <tr><td>Name</td><td>${customerName}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
      <tr><td>Phone</td><td>${customerPhone}</td></tr>
      <tr><td>Reference</td><td>#${ref}</td></tr>
    </table>
    <h3>Chosen Configuration (Option ${chosenOption})</h3>
    <table>
      ${optionDetails.vanTitle ? `<tr><td>Van</td><td>${optionDetails.vanTitle}</td></tr>` : ''}
      ${optionDetails.kitName ? `<tr><td>Pack</td><td>${optionDetails.kitName}</td></tr>` : ''}
      ${optionDetails.upgradeNames && optionDetails.upgradeNames.length > 0 ? `<tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${optionDetails.upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul></td></tr>` : ''}
      ${totalStr ? `<tr class="total"><td>Total (inc. VAT)</td><td>${totalStr}</td></tr>` : ''}
    </table>
    <p style="margin-top:16px;font-size:13px;color:#6b7280;">Log in to the admin panel to view the full quote and continue the build process.</p>
  `;

  await sendOrThrow(client, {
    to: toOverride ?? await getInternalNotifyEmails('option_chosen'),
    from: fromEmail,
    subject: `Customer chose Option ${chosenOption} – ${customerName} – Ref #${ref}`,
    html: emailLayout(bodyHtml, {
      extraCss: `
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
        .total td { font-weight: bold; font-size: 15px; border-top: 2px solid ${BRAND_GREEN}; }
      `,
    }),
    text: `Customer Option Selection\n\nA customer has selected Option ${chosenOption} from their comparison quote.\n\nName: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone}\nReference: #${ref}\n${optionDetails.vanTitle ? `Van: ${optionDetails.vanTitle}\n` : ''}${optionDetails.kitName ? `Pack: ${optionDetails.kitName}\n` : ''}${optionDetails.upgradeNames && optionDetails.upgradeNames.length > 0 ? `Upgrades:\n${optionDetails.upgradeNames.map(u => `  - ${u}`).join('\n')}\n` : ''}${totalStr ? `Total: ${totalStr}\n` : ''}`,
  });
}

// ── Lead received: customer confirmation + admin notification ─────────────────
export async function sendLeadReceivedEmails(lead: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  testMode?: { variant: 'customer' | 'admin'; testAddress: string };
}) {
  // Never send real emails for test/e2e submissions
  if (isTestEmail(lead.email)) {
    console.log(`[E2E] Suppressing lead emails for test address: ${lead.email}`);
    return;
  }

  const { client, fromEmail } = await getUncachableResendClient();

  const ref = lead.id.slice(0, 8).toUpperCase();

  // 1. Customer confirmation
  const custBodyHtml = `
    <p>Hi ${lead.name},</p>
    <p>Thank you for getting in touch with ${BRAND_NAME}. We've received your enquiry and one of our team will be in touch with you shortly.</p>
    <div class="ref-box">
      <p><strong>Your reference number:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    ${lead.message ? `<p><strong>Your message:</strong><br><em>"${lead.message}"</em></p>` : ''}
    <p>If you need to speak to us urgently, please call <strong>${PHONE}</strong>.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  if (!lead.testMode || lead.testMode.variant === 'customer') {
    await sendOrThrow(client, {
      to: lead.email,
      from: fromEmail,
      subject: `We've received your enquiry – ${BRAND_NAME}`,
      html: emailLayout(custBodyHtml, {
        extraCss: `
          .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
          .ref-box p { margin: 0; }
        `,
        footerNote: 'If you did not submit this enquiry, please disregard this email.',
      }),
      text: `Hi ${lead.name},\n\nThank you for getting in touch. We've received your enquiry and will be in touch shortly.\n\nReference: #${ref}\n${lead.message ? `Your message: "${lead.message}"\n` : ''}\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`,
    });
  }

  // 2. Admin notification
  const adminBodyHtml = `
    <h2 style="color:${BRAND_DARK}; border-bottom: 3px solid ${BRAND_GREEN}; padding-bottom: 8px;">New Enquiry Received</h2>
    <table>
      <tr><td>Name</td><td>${lead.name}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
      ${lead.phone ? `<tr><td>Phone</td><td>${lead.phone}</td></tr>` : ''}
      <tr><td>Reference</td><td>#${ref}</td></tr>
    </table>
    ${lead.message ? `<p><strong>Message:</strong></p><div class="message-box">${lead.message}</div>` : '<p><em>No message provided.</em></p>'}
  `;

  if (!lead.testMode || lead.testMode.variant === 'admin') {
    await sendOrThrow(client, {
      to: lead.testMode ? lead.testMode.testAddress : await getInternalNotifyEmails('lead_enquiry'),
      from: fromEmail,
      subject: `New enquiry – ${lead.name}${lead.phone ? ` – ${lead.phone}` : ''} – Ref #${ref}`,
      html: emailLayout(adminBodyHtml, {
        extraCss: `
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
          .message-box { background: #f9fafb; padding: 15px; border-radius: 4px; border-left: 4px solid ${BRAND_GREEN}; margin-top: 16px; white-space: pre-wrap; font-size: 14px; }
        `,
      }),
      text: `New enquiry\n\nName: ${lead.name}\nEmail: ${lead.email}\n${lead.phone ? `Phone: ${lead.phone}\n` : ''}Reference: #${ref}\n${lead.message ? `\nMessage:\n${lead.message}` : ''}`,
    });
  }
}

// ── New user welcome email (credentials provided) ─────────────────────────────
export async function sendNewUserWelcomeEmail({
  toEmail,
  firstName,
  username,
  password,
  loginUrl,
}: {
  toEmail: string;
  firstName?: string | null;
  username: string;
  password: string;
  loginUrl: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const displayName = firstName || username;

  const bodyHtml = `
    <p>Hi ${displayName},</p>
    <p>An account has been created for you on the ${BRAND_NAME} portal. You can use the details below to sign in.</p>
    <div class="credentials-box">
      <table>
        <tr><td>Username</td><td>${username}</td></tr>
        <tr><td>Password</td><td>${password}</td></tr>
      </table>
    </div>
    <div style="text-align:center;">
      <a href="${loginUrl}" class="cta-btn">Sign In Now</a>
    </div>
    <p style="color:#6b7280; font-size:13px; margin-top:20px;">For your security, we recommend changing your password after your first login. If you have any trouble accessing your account, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to: toEmail,
    from: fromEmail,
    subject: `Your ${BRAND_NAME} account has been created`,
    html: emailLayout(bodyHtml, {
      extraCss: `
        .credentials-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px 24px; margin: 20px 0; }
        .credentials-box table { width: 100%; border-collapse: collapse; }
        .credentials-box td { padding: 6px 0; font-size: 15px; }
        .credentials-box td:first-child { color: #6b7280; width: 38%; font-weight: 500; }
        .credentials-box td:last-child { font-weight: bold; font-family: monospace; font-size: 15px; }
        .cta-btn { display: block; max-width: 240px; margin: 16px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 13px 28px; border-radius: 4px; font-weight: bold; font-size: 15px; text-align: center; box-sizing: border-box; }
        @media screen and (max-width: 600px) { .cta-btn { max-width: 100% !important; } }
      `,
      footerNote: 'If you did not expect this email, please contact us immediately on ' + PHONE + '.',
    }),
    text: `Hi ${displayName},\n\nAn account has been created for you on the ${BRAND_NAME} portal.\n\nUsername: ${username}\nPassword: ${password}\n\nSign in at: ${loginUrl}\n\nFor your security, we recommend changing your password after your first login.\n\nIf you need help, call us on ${PHONE}.\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── New user set-password email ───────────────────────────────────────────────
export async function sendNewUserSetPasswordEmail({
  toEmail,
  firstName,
  username,
  setPasswordUrl,
}: {
  toEmail: string;
  firstName?: string | null;
  username: string;
  setPasswordUrl: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const displayName = firstName || username;

  const bodyHtml = `
    <p>Hi ${displayName},</p>
    <p>You've been set up as an admin on the <strong>${BRAND_NAME}</strong> portal. To get started, you'll need to set your own password using the button below.</p>
    <div class="info-box">
      <table>
        <tr><td>Username</td><td>${username}</td></tr>
      </table>
    </div>
    <p style="text-align:center;">
      <a href="${setPasswordUrl}" class="cta-btn">Set Your Password</a>
    </p>
    <p class="expiry-note">This link will expire in <strong>24 hours</strong>. If you weren't expecting this email, you can ignore it safely — no account access will be granted without setting a password.</p>
    <p>If the button above doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break:break-all; font-size:13px; color:#6b7280;">${setPasswordUrl}</p>
    <p>If you have any trouble, call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to: toEmail,
    from: fromEmail,
    subject: `You've been set up on ${BRAND_NAME} — set your password`,
    html: emailLayout(bodyHtml, {
      extraCss: `
        .info-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px 24px; margin: 20px 0; }
        .info-box table { width: 100%; border-collapse: collapse; }
        .info-box td { padding: 6px 0; font-size: 15px; }
        .info-box td:first-child { color: #6b7280; width: 38%; font-weight: 500; }
        .info-box td:last-child { font-weight: bold; }
        .cta-btn { display: inline-block; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-weight: bold; font-size: 16px; margin: 20px 0; }
        .expiry-note { color: #6b7280; font-size: 13px; margin-top: 0; }
      `,
      footerNote: 'If you did not expect this email, please contact us on ' + PHONE + '.',
    }),
    text: `Hi ${displayName},\n\nYou've been set up as an admin on the ${BRAND_NAME} portal.\n\nYour username is: ${username}\n\nTo activate your account, please set your password here:\n${setPasswordUrl}\n\nThis link expires in 24 hours.\n\nIf you need help, call us on ${PHONE}.\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── Password reset email ──────────────────────────────────────────────────────
export async function sendPasswordResetEmail({
  toEmail,
  firstName,
  username,
  resetUrl,
}: {
  toEmail: string;
  firstName?: string | null;
  username: string;
  resetUrl: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const displayName = firstName || username;

  const bodyHtml = `
    <p>Hi ${displayName},</p>
    <p>We received a request to reset the password for your account (<strong>${username}</strong>). Click the button below to set a new password.</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="cta-btn">Reset My Password</a>
    </p>
    <p style="color:#6b7280; font-size:13px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <div class="url-box">${resetUrl}</div>
    <p style="color:#6b7280; font-size:13px;"><strong>This link will expire in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to: toEmail,
    from: fromEmail,
    subject: `Reset your ${BRAND_NAME} password`,
    html: emailLayout(bodyHtml, {
      extraCss: `
        .cta-btn { display: inline-block; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-weight: bold; font-size: 15px; margin: 20px 0; }
        .url-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #374151; }
      `,
      footerNote: 'If you need help, call us on ' + PHONE + '.',
    }),
    text: `Hi ${displayName},\n\nWe received a request to reset the password for your account (${username}).\n\nReset your password here:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, you can safely ignore this email.\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── Depot invoice email ───────────────────────────────────────────────────────
export async function sendDepotInvoiceEmail({
  quoteId,
  customerName,
  customerPhone,
  customerEmail,
  vanDetails,
  kitName,
  upgradeNames,
  customExtras,
  subtotal,
  vat,
  discount,
  total,
  financeInfo,
  toOverride,
}: {
  quoteId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  vanDetails: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    registration?: string | null;
    mileage?: number | null;
    transmission?: string | null;
    fuelType?: string | null;
    title?: string | null;
    isCustom?: boolean;
    customDescription?: string | null;
  };
  kitName?: string | null;
  upgradeNames?: string[];
  customExtras?: Array<{ id: string; description: string; pricePence: number }>;
  subtotal: number;
  vat: number;
  discount?: number;
  total: number;
  financeInfo?: {
    depositAmount: number;
    termMonths: number;
    monthlyPayment: number;
    weeklyPayment: number;
  } | null;
  toOverride?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const ref = quoteId.slice(0, 8).toUpperCase();
  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

  const totalAfterDiscount = discount && discount > 0 ? total - discount : total;

  // Pre-discount breakdown — needed so the email shows the full list price
  // before the discount row, making the maths immediately obvious to admins.
  // `total` is always the pre-discount total inc. VAT; back-calculate ex-VAT parts.
  const preDiscountVAT = discount && discount > 0 ? Math.round(total / 6) : vat;
  const preDiscountSubtotal = discount && discount > 0 ? total - preDiscountVAT : subtotal;

  const vanDescriptionLines: string[] = [];
  if (vanDetails.isCustom) {
    vanDescriptionLines.push(vanDetails.customDescription || 'Customer-supplied van');
  } else {
    if (vanDetails.title) vanDescriptionLines.push(vanDetails.title);
    else if (vanDetails.make || vanDetails.model || vanDetails.year) {
      vanDescriptionLines.push([vanDetails.year, vanDetails.make, vanDetails.model].filter(Boolean).join(' '));
    }
  }
  if (vanDetails.registration) vanDescriptionLines.push(`Reg: ${vanDetails.registration.toUpperCase()}`);
  if (vanDetails.mileage != null) vanDescriptionLines.push(`Mileage: ${vanDetails.mileage.toLocaleString('en-GB')} miles`);
  if (vanDetails.transmission) vanDescriptionLines.push(`Transmission: ${vanDetails.transmission}`);
  if (vanDetails.fuelType) vanDescriptionLines.push(`Fuel: ${vanDetails.fuelType}`);

  const vanTableRows = vanDescriptionLines.map(l => `<tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">${l}</td></tr>`).join('');

  const upgradesList = upgradeNames && upgradeNames.length > 0
    ? `<ul style="margin:4px 0; padding-left:18px;">${upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('')}</ul>`
    : '<em style="color:#6b7280;">None</em>';

  const extrasList = customExtras && customExtras.length > 0
    ? `<ul style="margin:4px 0; padding-left:18px;">${customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} &mdash; ${fmt(e.pricePence)}</li>`).join('')}</ul>`
    : '';

  const financeRows = financeInfo ? `
    <tr><td colspan="2" style="padding:10px 12px 4px; font-weight:bold; font-size:13px; color:${BRAND_DARK}; border-top:1px solid #e5e7eb;">Finance (HP – 10.9% APR est.)</td></tr>
    <tr><td>Deposit</td><td>${fmt(financeInfo.depositAmount)}</td></tr>
    <tr><td>Term</td><td>${financeInfo.termMonths} months${financeInfo.termMonths % 12 === 0 ? ` (${financeInfo.termMonths / 12} yr)` : ''}</td></tr>
    <tr><td>Monthly (est.)</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(financeInfo.monthlyPayment)}/month</td></tr>
    <tr><td>Weekly (est.)</td><td>${fmt(financeInfo.weeklyPayment)}/week</td></tr>
  ` : '';

  const financeText = financeInfo
    ? `\nFinance (HP – 10.9% APR est.)\nDeposit: ${fmt(financeInfo.depositAmount)}\nTerm: ${financeInfo.termMonths} months\nMonthly: ${fmt(financeInfo.monthlyPayment)}\nWeekly: ${fmt(financeInfo.weeklyPayment)}\n`
    : '';

  const extrasText = customExtras && customExtras.length > 0
    ? `Bespoke Extras:\n${customExtras.map(e => `  - ${e.description} (${fmt(e.pricePence)})`).join('\n')}\n`
    : '';

  const depotBodyHtml = `
    <div class="ref-box">Invoice Request — Quote <strong>#${ref}</strong></div>

    <div class="section-title">Customer</div>
    <table>
      <tr><td>Name</td><td>${customerName}</td></tr>
      ${customerPhone ? `<tr><td>Phone</td><td>${customerPhone}</td></tr>` : ''}
      ${customerEmail ? `<tr><td>Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>` : ''}
    </table>

    <div class="section-title">Van Details</div>
    <table>
      ${vanTableRows || `<tr><td colspan="2" style="padding:8px 12px; color:#6b7280; font-size:14px;">No van details recorded</td></tr>`}
    </table>

    <div class="section-title">Build Specification</div>
    <table>
      ${kitName ? `<tr><td style="font-weight:500;">Conversion Pack</td><td>${kitName}</td></tr>` : ''}
      <tr><td style="font-weight:500;">Upgrades</td><td>${upgradesList}</td></tr>
      ${extrasList ? `<tr><td style="font-weight:500;">Bespoke Extras</td><td>${extrasList}</td></tr>` : ''}
    </table>

    <div class="section-title">Pricing</div>
    <table>
      ${discount && discount > 0 ? `
        <tr><td>Subtotal (ex. VAT)</td><td>${fmt(preDiscountSubtotal)}</td></tr>
        <tr><td>VAT (20%)</td><td>${fmt(preDiscountVAT)}</td></tr>
        <tr><td>List Price (inc. VAT)</td><td>${fmt(total)}</td></tr>
        <tr><td style="color:#166534; font-weight:600; border-top:2px solid #e5e7eb;">Discount</td><td style="color:#166534; font-weight:600; border-top:2px solid #e5e7eb;">−${fmt(discount)}</td></tr>
        <tr class="total-row"><td>Total Payable (inc. VAT)</td><td>${fmt(totalAfterDiscount)}</td></tr>
      ` : `
        <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
        <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
        <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(totalAfterDiscount)}</td></tr>
      `}
      ${financeRows}
    </table>
  `;

  const text = `DEPOT INVOICE REQUEST — Quote #${ref}

CUSTOMER
Name: ${customerName}${customerPhone ? `\nPhone: ${customerPhone}` : ''}${customerEmail ? `\nEmail: ${customerEmail}` : ''}

VAN DETAILS
${vanDescriptionLines.join('\n') || 'No van details recorded'}

BUILD SPECIFICATION
${kitName ? `Conversion Pack: ${kitName}\n` : ''}Upgrades:
${upgradeNames && upgradeNames.length > 0 ? upgradeNames.map(u => `  - ${u}`).join('\n') : '  None'}
${extrasText}
PRICING
${discount && discount > 0
  ? `Subtotal (ex. VAT): ${fmt(preDiscountSubtotal)}\nVAT (20%): ${fmt(preDiscountVAT)}\nList Price (inc. VAT): ${fmt(total)}\nDiscount: -${fmt(discount)}\nTotal Payable (inc. VAT): ${fmt(totalAfterDiscount)}`
  : `Subtotal (ex. VAT): ${fmt(subtotal)}\nVAT (20%): ${fmt(vat)}\nTotal (inc. VAT): ${fmt(totalAfterDiscount)}`}
${financeText}
${BRAND_NAME} | ${PHONE}
${ADDRESS}`;

  await sendOrThrow(client, {
    to: toOverride ?? await getInternalNotifyEmails('depot_invoice'),
    from: fromEmail,
    subject: `Invoice Request – Quote #${ref} – ${customerName}`,
    html: emailLayout(depotBodyHtml, {
      maxWidth: 620,
      extraCss: `
        .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 12px 18px; border-radius: 4px; margin-bottom: 20px; font-size: 15px; }
        .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 20px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
        td:first-child { color: #6b7280; width: 38%; }
        .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
        .total-row td:last-child { color: ${BRAND_GREEN}; }
        @media screen and (max-width: 600px) {
          td { padding: 8px 6px !important; }
          td:first-child { width: 42% !important; }
        }
      `,
    }),
    text,
  });
}

// ── Testimonial / review request email ────────────────────────────────────────
export async function sendTestimonialRequestEmail({
  to,
  customerName,
  reviewUrl,
}: {
  to: string;
  customerName: string;
  reviewUrl: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();

  const bodyHtml = `
    <p>Hi ${customerName},</p>
    <p>Thank you for choosing ${BRAND_NAME}. We hope you're delighted with your new mobile tyre van.</p>
    <p>We'd be really grateful if you could spare 2 minutes to leave us a quick review. It helps other people make confident decisions and means a lot to our team.</p>
    <div class="stars">&#9733; &#9733; &#9733; &#9733; &#9733;</div>
    <div style="text-align:center;">
      <a href="${reviewUrl}" class="cta-btn">Leave a review</a>
    </div>
    <p style="font-size: 13px; color: #6b7280; text-align: center; margin-top:12px;">Or copy this link into your browser:<br />${reviewUrl}</p>
  `;

  await sendOrThrow(client, {
    to,
    from: fromEmail,
    subject: `Would you leave us a review? – ${BRAND_NAME}`,
    html: emailLayout(bodyHtml, {
      extraCss: `
        .cta-btn { display: block; max-width: 260px; margin: 24px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; box-sizing: border-box; }
        .stars { font-size: 28px; letter-spacing: 4px; text-align: center; margin: 16px 0; color: ${BRAND_GREEN}; }
      `,
      footerNote: 'This link is personal to you and can only be used once.',
    }),
  });
}

// ── Email preview (admin design sign-off) ────────────────────────────────────

// ── Follow-up reminder email (sent to assigned staff on the day) ──────────────
export async function sendFollowUpReminderEmail({
  to,
  assignedToName,
  customerName,
  customerPhone,
  customerEmail,
  scheduledDate,
  notes,
  leadId,
  quoteId,
  baseUrl,
}: {
  to: string;
  assignedToName: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  scheduledDate: string;
  notes?: string | null;
  leadId?: string | null;
  quoteId?: string | null;
  baseUrl: string;
}): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  const formattedDate = new Date(scheduledDate + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const linkRow = leadId
    ? `<tr><td style="color:#6b7280;padding:6px 0;">Lead</td><td><a href="${baseUrl}/admin/leads" style="color:${BRAND_GREEN};">View lead record</a></td></tr>`
    : quoteId
    ? `<tr><td style="color:#6b7280;padding:6px 0;">Configurator</td><td><a href="${baseUrl}/admin/quotes/${quoteId}" style="color:${BRAND_GREEN};">View configurator</a></td></tr>`
    : '';

  const body = `
    <p>Hi ${assignedToName},</p>
    <p>You have a customer follow-up scheduled for <strong>today (${formattedDate})</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tbody>
        <tr>
          <td style="color:#6b7280;padding:10px 16px;width:40%;border-bottom:1px solid #e5e7eb;">Customer</td>
          <td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">${customerName}</td>
        </tr>
        ${customerPhone ? `<tr><td style="color:#6b7280;padding:10px 16px;border-bottom:1px solid #e5e7eb;">Phone</td><td style="padding:10px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;"><a href="tel:${customerPhone}" style="color:${BRAND_GREEN};">${customerPhone}</a></td></tr>` : ''}
        ${customerEmail ? `<tr><td style="color:#6b7280;padding:10px 16px;border-bottom:1px solid #e5e7eb;">Email</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;"><a href="mailto:${customerEmail}" style="color:${BRAND_GREEN};">${customerEmail}</a></td></tr>` : ''}
        ${notes ? `<tr><td style="color:#6b7280;padding:10px 16px;border-bottom:1px solid #e5e7eb;">Notes</td><td style="padding:10px 16px;font-style:italic;border-bottom:1px solid #e5e7eb;">${notes}</td></tr>` : ''}
        ${linkRow ? `<tr><td style="color:#6b7280;padding:10px 16px;">${linkRow.match(/<td[^>]*>([^<]*)<\/td>/)?.[1] ?? 'Link'}</td><td style="padding:10px 16px;">${linkRow.match(/<a[^>]*>.*?<\/a>/)?.[0] ?? ''}</td></tr>` : ''}
      </tbody>
    </table>
    <a href="${baseUrl}/admin/calendar" style="display:inline-block;background:${BRAND_GREEN};color:${BRAND_DARK};padding:12px 28px;text-decoration:none;border-radius:5px;font-weight:bold;margin-top:8px;">View Calendar</a>
    <p style="color:#6b7280;font-size:13px;margin-top:20px;">Log in to the admin panel to mark this follow-up as complete or reschedule it.</p>
  `;

  await sendOrThrow(client, {
    from: fromEmail,
    to,
    subject: `Follow-up reminder: ${customerName} — ${formattedDate}`,
    html: emailLayout(body),
  });
}

export const EMAIL_PREVIEW_TYPES = [
  { type: 'quote-confirmation',        label: 'Quote Confirmation',              description: 'Sent to a customer when admin manually confirms their quote is ready.' },
  { type: 'quote-spec-summary',        label: 'Quote Spec Summary',              description: 'Full specification summary sent to the customer after admin discussion (supports single-van and A/B comparison modes).' },
  { type: 'quote-received-customer',   label: 'Quote Received (Customer)',       description: 'Immediate acknowledgement sent to a customer after they submit the configurator.' },
  { type: 'quote-received-admin',      label: 'Quote Received (Admin)',          description: 'Internal notification your team receives when a configurator enquiry comes in.' },
  { type: 'option-chosen-admin',       label: 'Option Chosen (Admin)',           description: 'Internal notification sent when a customer picks Option A or B from a comparison quote.' },
  { type: 'lead-received-customer',    label: 'Lead Received (Customer)',        description: 'Confirmation sent to someone who fills in a contact / enquiry form.' },
  { type: 'lead-received-admin',       label: 'Lead Received (Admin)',           description: 'Internal notification when a contact / enquiry form is submitted.' },
  { type: 'finance-submission',        label: 'Finance Submission',              description: 'Application email sent to the finance company when a customer proceeds with finance.' },
  { type: 'new-user-welcome',          label: 'New User Welcome',                description: 'Sent to a new admin user with their login credentials.' },
  { type: 'new-user-set-password',     label: 'New User Set Password',           description: 'Onboarding email with a link for the new user to choose their own password.' },
  { type: 'password-reset',            label: 'Password Reset',                  description: 'Sent when an admin user requests a password reset link.' },
  { type: 'testimonial-request',       label: 'Testimonial Request',             description: 'Sent to a completed customer asking them for a review.' },
  { type: 'depot-invoice',             label: 'Depot Invoice Request',           description: 'Internal invoice request sent to the depot when a job is confirmed.' },
] as const;

export type EmailPreviewType = typeof EMAIL_PREVIEW_TYPES[number]['type'];

const PREVIEW_BANNER = `
  <div style="background:#fef3c7;border:2px solid #d97706;border-radius:6px;padding:14px 20px;margin-bottom:24px;text-align:center;">
    <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#92400e;letter-spacing:0.03em;">PREVIEW — NOT A REAL EMAIL</p>
    <p style="margin:0;font-size:13px;color:#92400e;">This is a design preview sent for internal sign-off only. All data shown is fictional. No real transaction has taken place.</p>
  </div>
`;

export async function sendEmailTypePreview(to: string, emailType: EmailPreviewType, baseUrl: string): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  const DUMMY_REF = 'A1B2C3D4';
  const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const summaryTableCss = `
    .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
    .ref-box p { margin: 0; }
    .summary { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .summary td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
    .summary td:first-child { color: #6b7280; width: 40%; }
    .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
    .cta-btn { display: block; max-width: 280px; margin: 20px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; box-sizing: border-box; }
    .price-box { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .credentials-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px 24px; margin: 20px 0; }
    .credentials-box table { width: 100%; border-collapse: collapse; }
    .credentials-box td { padding: 6px 0; font-size: 15px; }
    .credentials-box td:first-child { color: #6b7280; width: 38%; font-weight: 500; }
    .credentials-box td:last-child { font-weight: bold; font-family: monospace; }
    .stars { font-size: 28px; letter-spacing: 4px; text-align: center; margin: 16px 0; color: ${BRAND_GREEN}; }
  `;

  let subject = '';
  let bodyHtml = '';
  let extraCss = summaryTableCss;
  let footerNote: string | undefined;

  switch (emailType) {
    case 'quote-confirmation': {
      subject = `[PREVIEW] Your Van Conversion Quote #${DUMMY_REF} is Ready`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi Jane Smith,</p>
        <p>Thank you for requesting a quote for your mobile tyre van conversion. We've reviewed your configuration and are pleased to present your custom quote.</p>
        <div class="price-box">
          <h2 style="margin-top:0;">Quote #${DUMMY_REF}</h2>
          <div style="background:#dcfce7;color:#166534;padding:15px;border-radius:8px;margin:15px 0;font-weight:bold;">Special Discount Applied — You Save £500.00!</div>
          <p style="font-size:28px;font-weight:bold;color:${BRAND_GREEN};margin:10px 0;">${fmt(1850000)}</p>
          <p style="color:#6b7280;margin:0;">Including VAT</p>
        </div>
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:15px;margin:20px 0;">
          <h3 style="margin-top:0;color:#1e40af;">Note from our team:</h3>
          <p style="margin:0;">We've included the extended warranty upgrade as discussed on your call — please review the spec summary carefully before confirming.</p>
        </div>
        <p>To proceed with your order, please review and confirm your quote by clicking the button below:</p>
        <div style="text-align:center;">
          <a href="${baseUrl}/quote/confirm/PREVIEW_TOKEN" class="cta-btn">Review &amp; Confirm Quote</a>
        </div>
        <p style="font-size:14px;color:#6b7280;margin-top:30px;">This confirmation link is for one-time use and will expire after confirmation.</p>
        <p>If you have any questions, please call us on <strong>${PHONE}</strong>.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = "If you didn't request this quote, please disregard this email.";
      break;
    }

    case 'quote-received-customer': {
      subject = `[PREVIEW] We've received your enquiry — Reference #${DUMMY_REF}`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi James Wilson,</p>
        <p>Thank you for your enquiry — we've received your van configuration and one of our team will be in touch shortly to discuss next steps.</p>
        <div class="ref-box">
          <p><strong>Your reference number: #${DUMMY_REF}</strong></p>
          <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Please quote this when contacting us.</p>
        </div>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Your Configuration Summary</h3>
        <table class="summary">
          <tr><td>Van</td><td>2022 Ford Transit Custom 280 L1 H1</td></tr>
          <tr><td>Pack</td><td>Silver — Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td>Racking System Upgrade, Generator Set, CCTV Package</td></tr>
          <tr><td>Subtotal</td><td>${fmt(1458333)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(291667)}</td></tr>
          <tr class="total-row"><td>Total</td><td>${fmt(1750000)}</td></tr>
        </table>
        <p>If you have any questions in the meantime, please call us on <strong>${PHONE}</strong>.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = `Call us anytime on ${PHONE} — we're happy to help.`;
      break;
    }

    case 'quote-received-admin': {
      subject = `[PREVIEW] New Configurator Enquiry — #${DUMMY_REF} — James Wilson`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>A new configurator enquiry has been submitted. Details are below.</p>
        <div class="ref-box">
          <p><strong>Reference: #${DUMMY_REF}</strong></p>
        </div>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Customer Details</h3>
        <table class="summary">
          <tr><td>Name</td><td>James Wilson</td></tr>
          <tr><td>Email</td><td>james.wilson@example.com</td></tr>
          <tr><td>Phone</td><td>07700 900 123</td></tr>
          <tr><td>Company</td><td>Wilson Tyre Services Ltd</td></tr>
        </table>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Configuration</h3>
        <table class="summary">
          <tr><td>Van</td><td>2022 Ford Transit Custom 280 L1 H1</td></tr>
          <tr><td>Pack</td><td>Silver — Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td>Racking System Upgrade, Generator Set, CCTV Package</td></tr>
          <tr><td>Subtotal</td><td>${fmt(1458333)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(291667)}</td></tr>
          <tr class="total-row"><td>Total</td><td>${fmt(1750000)}</td></tr>
        </table>
        <p style="text-align:center;">
          <a href="${baseUrl}/admin/quotes" class="cta-btn">View in Admin Panel</a>
        </p>
      `;
      break;
    }

    case 'lead-received-customer': {
      subject = `[PREVIEW] Thanks for your enquiry — Reference #${DUMMY_REF}`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi Sarah Johnson,</p>
        <p>Thank you for getting in touch with ${BRAND_NAME}. We've received your message and will get back to you as soon as possible.</p>
        <div class="ref-box">
          <p><strong>Your reference number: #${DUMMY_REF}</strong></p>
          <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Please quote this if you contact us.</p>
        </div>
        <div style="background:#f9fafb;padding:15px;border-radius:4px;border-left:4px solid ${BRAND_GREEN};margin-top:16px;white-space:pre-wrap;font-size:14px;">I'm interested in finding out more about mobile tyre van conversions for our fleet. Could someone please give me a call?</div>
        <p>If you have any questions in the meantime, please call us on <strong>${PHONE}</strong>.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = `Call us anytime on ${PHONE} — we're happy to help.`;
      break;
    }

    case 'lead-received-admin': {
      subject = `[PREVIEW] New Enquiry — Sarah Johnson`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>A new enquiry has been submitted via the contact form.</p>
        <div class="ref-box">
          <p><strong>Reference: #${DUMMY_REF}</strong></p>
        </div>
        <table class="summary">
          <tr><td>Name</td><td>Sarah Johnson</td></tr>
          <tr><td>Email</td><td>sarah.johnson@example.com</td></tr>
          <tr><td>Phone</td><td>07700 900 456</td></tr>
        </table>
        <div style="background:#f9fafb;padding:15px;border-radius:4px;border-left:4px solid ${BRAND_GREEN};margin-top:16px;white-space:pre-wrap;font-size:14px;">I'm interested in finding out more about mobile tyre van conversions for our fleet. Could someone please give me a call?</div>
        <p style="text-align:center;">
          <a href="${baseUrl}/admin/leads" class="cta-btn">View in Admin Panel</a>
        </p>
      `;
      break;
    }

    case 'new-user-welcome': {
      subject = `[PREVIEW] Your ${BRAND_NAME} account has been created`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi Alex,</p>
        <p>An account has been created for you on the ${BRAND_NAME} portal. You can use the details below to sign in.</p>
        <div class="credentials-box">
          <table>
            <tr><td>Username</td><td>alex.patel</td></tr>
            <tr><td>Password</td><td>Temp@Pass123!</td></tr>
          </table>
        </div>
        <div style="text-align:center;">
          <a href="${baseUrl}/login" class="cta-btn">Sign In Now</a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">For your security, we recommend changing your password after your first login. If you have any trouble accessing your account, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = `If you did not expect this email, please contact us immediately on ${PHONE}.`;
      break;
    }

    case 'new-user-set-password': {
      subject = `[PREVIEW] You've been set up on ${BRAND_NAME} — set your password`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi Alex,</p>
        <p>You've been set up as an admin on the <strong>${BRAND_NAME}</strong> portal. To get started, you'll need to set your own password using the button below.</p>
        <div class="credentials-box">
          <table>
            <tr><td>Username</td><td>alex.patel</td></tr>
          </table>
        </div>
        <p style="text-align:center;">
          <a href="${baseUrl}/reset-password/PREVIEW_TOKEN" class="cta-btn">Set Your Password</a>
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:0;">This link will expire in <strong>24 hours</strong>. If you weren't expecting this email, you can ignore it safely — no account access will be granted without setting a password.</p>
        <p>If you have any trouble, call us on <strong>${PHONE}</strong> or reply to this email.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = `If you did not expect this email, please contact us on ${PHONE}.`;
      break;
    }

    case 'password-reset': {
      subject = `[PREVIEW] Reset your ${BRAND_NAME} password`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi Alex,</p>
        <p>We received a request to reset the password for your account (<strong>alex.patel</strong>).</p>
        <p style="text-align:center;">
          <a href="${baseUrl}/reset-password/PREVIEW_TOKEN" class="cta-btn">Reset My Password</a>
        </p>
        <p style="color:#6b7280;font-size:13px;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not be changed.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = "If you did not request this, no action is needed.";
      break;
    }

    case 'testimonial-request': {
      subject = `[PREVIEW] How was your ${BRAND_NAME} experience?`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi James,</p>
        <p>We hope you're enjoying your new mobile tyre van setup. We'd love to hear about your experience with ${BRAND_NAME}!</p>
        <div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>Sharing your feedback helps other businesses like yours discover our service — and it means the world to us.</p>
        <div style="text-align:center;">
          <a href="https://g.page/r/PREVIEW_REVIEW_LINK" class="cta-btn">Leave a Review</a>
        </div>
        <p>It only takes a minute and we genuinely appreciate every review.</p>
        <p>Thank you,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = 'This link is personal to you and can only be used once.';
      break;
    }

    case 'depot-invoice': {
      subject = `[PREVIEW] Invoice Request — Quote #${DUMMY_REF} — James Wilson`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Please raise an invoice for the following confirmed build.</p>
        <div class="ref-box">
          <p><strong>Quote Reference: #${DUMMY_REF}</strong></p>
        </div>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Customer Details</h3>
        <table class="summary">
          <tr><td>Name</td><td>James Wilson</td></tr>
          <tr><td>Email</td><td>james.wilson@example.com</td></tr>
          <tr><td>Phone</td><td>07700 900 123</td></tr>
        </table>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Vehicle &amp; Build</h3>
        <table class="summary">
          <tr><td colspan="2" style="padding:5px 12px;font-size:14px;color:#374151;">2022 Ford Transit Custom 280 L1 H1</td></tr>
          <tr><td colspan="2" style="padding:5px 12px;font-size:14px;color:#374151;">Reg: MT22 VAN</td></tr>
          <tr><td colspan="2" style="padding:5px 12px;font-size:14px;color:#374151;">Mileage: 12,500 miles</td></tr>
          <tr><td>Pack</td><td>Silver — Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;"><li>Racking System Upgrade</li><li>Generator Set</li></ul></td></tr>
          <tr><td>Subtotal</td><td>${fmt(1458333)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(291667)}</td></tr>
          <tr class="total-row"><td>Total</td><td>${fmt(1750000)}</td></tr>
        </table>
      `;
      break;
    }

    case 'quote-spec-summary': {
      subject = `[PREVIEW] Your Van Conversion Specification — Quote #${DUMMY_REF}`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Hi James,</p>
        <p>Thank you for discussing your van conversion requirements with us. We're pleased to present your tailored specification summary below for your review.</p>
        <div class="ref-box">
          <p><strong>Quote Reference: #${DUMMY_REF}</strong></p>
        </div>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Your Specification</h3>
        <table class="summary">
          <tr><td>Van</td><td>2022 Ford Transit Custom 280 L1 H1</td></tr>
          <tr><td>Pack</td><td>Silver — Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;"><li>Racking System Upgrade</li><li>Generator Set</li><li>CCTV Package</li></ul></td></tr>
          <tr><td>Subtotal</td><td>${fmt(1458333)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(291667)}</td></tr>
          <tr class="total-row"><td>Total</td><td>${fmt(1750000)}</td></tr>
        </table>
        <div style="background:#f3f4f6;padding:16px 20px;border-radius:6px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Estimated monthly payments (subject to approval)</p>
          <p style="margin:0;font-size:22px;font-weight:bold;color:${BRAND_GREEN};">${fmt(42800)} / month</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Based on ${fmt(35000)} deposit, 60-month term, 12.9% APR representative</p>
        </div>
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:15px;margin:20px 0;border-radius:4px;">
          <h3 style="margin-top:0;color:#1e40af;">Note from our team:</h3>
          <p style="margin:0;">We've included the extended CCTV package as discussed. Please review the spec and let us know if you'd like any adjustments.</p>
        </div>
        <p>Please review this specification carefully. Once you're happy, you can approve it using the link below:</p>
        <div style="text-align:center;">
          <a href="${baseUrl}/spec-approval/PREVIEW_TOKEN?status=approved" class="cta-btn">Approve This Specification</a>
        </div>
        <p style="font-size:13px;color:#6b7280;text-align:center;margin-top:8px;">Or <a href="${baseUrl}/spec-approval/PREVIEW_TOKEN?status=rejected" style="color:#dc2626;">request changes</a> if anything needs adjusting.</p>
        <p>If you have any questions, please call us on <strong>${PHONE}</strong>.</p>
        <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
      `;
      footerNote = "If you didn't request this specification, please call us on " + PHONE + ".";
      break;
    }

    case 'option-chosen-admin': {
      subject = `[PREVIEW] Customer chose Option B — James Wilson — Ref #${DUMMY_REF}`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <div style="display:inline-block;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:bold;font-size:13px;padding:4px 14px;border-radius:4px;margin-bottom:16px;">Option B Selected</div>
        <h3 style="margin-top:0;">Customer Details</h3>
        <table class="summary">
          <tr><td>Name</td><td>James Wilson</td></tr>
          <tr><td>Email</td><td>james.wilson@example.com</td></tr>
          <tr><td>Phone</td><td>07700 900 123</td></tr>
          <tr><td>Reference</td><td>#${DUMMY_REF}</td></tr>
        </table>
        <h3>Chosen Configuration (Option B)</h3>
        <table class="summary">
          <tr><td>Van</td><td>2023 Mercedes Sprinter 314 CDI L2 H2</td></tr>
          <tr><td>Pack</td><td>Gold — Premium Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;"><li>Racking System Upgrade</li><li>Generator Set</li><li>CCTV Package</li><li>Air Compressor</li></ul></td></tr>
          <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(2100000)}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">Log in to the admin panel to view the full quote and continue the build process.</p>
        <div style="text-align:center;">
          <a href="${baseUrl}/admin/quotes" class="cta-btn">View in Admin Panel</a>
        </div>
      `;
      break;
    }

    case 'finance-submission': {
      subject = `[PREVIEW] Finance Application — ${DUMMY_REF} — James Wilson`;
      bodyHtml = `
        ${PREVIEW_BANNER}
        <p>Please find below the details for a finance application from one of our customers who would like to proceed with a van conversion.</p>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Customer Details</h3>
        <table class="summary">
          <tr><td>Name</td><td>James Wilson</td></tr>
          <tr><td>Phone</td><td>07700 900 123</td></tr>
          <tr><td>Email</td><td>james.wilson@example.com</td></tr>
          <tr><td>Reference</td><td>#${DUMMY_REF}</td></tr>
        </table>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Vehicle Details</h3>
        <table class="summary">
          <tr><td>Van</td><td>2022 Ford Transit Custom 280 L1 H1</td></tr>
          <tr><td>Registration</td><td>MT22 VAN</td></tr>
          <tr><td>Mileage</td><td>12,500 miles</td></tr>
        </table>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Conversion Specification</h3>
        <table class="summary">
          <tr><td>Pack</td><td>Silver — Mobile Tyre Service Pack</td></tr>
          <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;"><li>Racking System Upgrade — ${fmt(75000)}</li><li>Generator Set — ${fmt(120000)}</li></ul></td></tr>
          <tr><td>Subtotal (ex. VAT)</td><td>${fmt(1458333)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(291667)}</td></tr>
          <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(1750000)}</td></tr>
        </table>
        <h3 style="border-bottom:2px solid ${BRAND_GREEN};padding-bottom:8px;">Finance Details</h3>
        <table class="summary">
          <tr><td>Plan Type</td><td>Hire Purchase (HP)</td></tr>
          <tr><td>APR</td><td>12.9% representative</td></tr>
          <tr><td>Deposit</td><td>${fmt(35000)}</td></tr>
          <tr><td>Term</td><td>60 months</td></tr>
          <tr><td>Monthly Payment</td><td>${fmt(42800)}</td></tr>
          <tr><td>Weekly Payment</td><td>${fmt(9876)}</td></tr>
        </table>
        <p style="font-size:13px;color:#6b7280;">Please contact the customer directly to proceed with the application. All enquiries to <strong>${PHONE}</strong>.</p>
      `;
      break;
    }
  }

  await sendOrThrow(client, {
    from: fromEmail,
    to,
    subject,
    html: emailLayout(bodyHtml, { extraCss, footerNote }),
  });
}

// ── Artwork proof approval email ──────────────────────────────────────────────
export async function sendArtworkProofEmail({
  to,
  customerName,
  proofId,
  token,
  files,
  adminNotes,
  siteBaseUrl,
}: {
  to: string;
  customerName: string;
  proofId: string;
  token: string;
  files: Array<{ url: string; name: string }>;
  adminNotes?: string | null;
  siteBaseUrl?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const siteBase = siteBaseUrl || process.env.SITE_URL || `https://${SITE_DOMAIN}`;

  const approveUrl = `${siteBase}/artwork-approval/${token}?status=approved`;
  const changesUrl = `${siteBase}/artwork-approval/${token}?status=changes_requested`;
  const viewUrl = `${siteBase}/artwork-approval/${token}`;

  const thumbnails = files.map(f => {
    // URL is already a presigned GCS URL or absolute — use as-is
    const imgSrc = f.url.startsWith('/') ? `${siteBase}${f.url}` : f.url;
    return `
      <div style="display:inline-block; margin:6px; vertical-align:top; max-width:180px;">
        <a href="${viewUrl}" style="text-decoration:none;">
          <img src="${imgSrc}" alt="${f.name}" style="max-width:180px; max-height:180px; border:1px solid #e5e7eb; border-radius:6px; display:block;" />
        </a>
        <p style="font-size:11px; color:#6b7280; margin:4px 0 0; word-break:break-word;">${f.name}</p>
      </div>
    `;
  }).join('');

  const bodyHtml = `
    <p>Hi ${customerName},</p>
    <p>Your artwork proof is ready for review. Please take a moment to look over the files below and let us know if everything looks correct or if any changes are needed.</p>
    ${adminNotes ? `<div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:15px; margin:20px 0; border-radius:4px;"><strong>Note from our team:</strong><br>${adminNotes}</div>` : ''}
    <h3 style="margin-bottom:12px;">Artwork Files</h3>
    <div style="margin-bottom:8px; background:#f9fafb; padding:16px; border-radius:6px; border:1px solid #e5e7eb;">
      ${thumbnails}
    </div>
    <p style="margin-bottom:24px; text-align:center;">
      <a href="${viewUrl}" style="font-size:13px; color:#4b5563; text-decoration:underline;">View full-size artwork &rarr;</a>
    </p>
    <p style="font-size:15px; font-weight:bold; margin-bottom:20px;">Does the artwork look correct?</p>
    <div style="text-align:center; margin:0 auto 24px;">
      <a href="${approveUrl}"
         style="display:block; max-width:280px; margin:0 auto 12px; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; text-align:center; box-sizing:border-box;">
        Yes — Approve Artwork
      </a>
      <a href="${changesUrl}"
         style="display:block; max-width:280px; margin:0 auto; background:#fff; color:#374151; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; border:1px solid #d1d5db; text-align:center; box-sizing:border-box;">
        Request Changes
      </a>
    </div>
    <p style="font-size:13px; color:#6b7280;">If you have any questions, please call us on <strong>${PHONE}</strong>.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to,
    from: fromEmail,
    subject: `Artwork Proof Ready for Review — ${BRAND_NAME}`,
    html: emailLayout(bodyHtml, {
      footerNote: "If you did not request artwork from us, please disregard this email.",
    }),
    text: `Hi ${customerName},\n\nYour artwork proof is ready for review.\n\n${adminNotes ? `Note from our team: ${adminNotes}\n\n` : ''}Please visit the link below to approve the artwork or request changes:\n\nApprove: ${approveUrl}\nRequest Changes: ${changesUrl}\n\nCall us: ${PHONE}\n\n${BRAND_NAME}\n${ADDRESS}`,
  });
}

// ── Artwork proof message notification to customer ────────────────────────────
export async function sendArtworkMessageToCustomer({
  to,
  customerName,
  senderName,
  message,
  token,
  siteBaseUrl,
}: {
  to: string;
  customerName: string;
  senderName: string;
  message: string;
  token: string;
  siteBaseUrl?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const siteBase = siteBaseUrl || process.env.SITE_URL || `https://${SITE_DOMAIN}`;
  const approvalUrl = `${siteBase}/artwork-approval/${token}`;

  const bodyHtml = `
    <p>Hi ${customerName},</p>
    <p>A member of our graphics team has sent you a message about your artwork proof.</p>
    <div style="background:#f3f4f6; border-left:4px solid ${BRAND_GREEN}; padding:16px; margin:20px 0; border-radius:4px;">
      <p style="margin:0 0 6px; font-size:12px; color:#6b7280; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">${senderName} · ${BRAND_NAME}</p>
      <p style="margin:0; white-space:pre-wrap; color:#111827;">${message}</p>
    </div>
    <p>You can reply and view your artwork by clicking the button below.</p>
    <div style="text-align:center; margin:24px auto;">
      <a href="${approvalUrl}"
         style="display:block; max-width:280px; margin:0 auto; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; text-align:center; box-sizing:border-box;">
        View Artwork &amp; Reply
      </a>
    </div>
    <p style="font-size:13px; color:#6b7280;">If you'd prefer to speak to someone, call us on <strong>${PHONE}</strong>.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;

  await sendOrThrow(client, {
    to,
    from: fromEmail,
    subject: `Message from ${BRAND_NAME} — Artwork Discussion`,
    html: emailLayout(bodyHtml, {
      footerNote: `This message is regarding your artwork proof from ${BRAND_NAME}.`,
    }),
    text: `Hi ${customerName},\n\n${senderName} from ${BRAND_NAME} says:\n\n"${message}"\n\nView your artwork and reply: ${approvalUrl}\n\nCall us: ${PHONE}\n\n${BRAND_NAME}`,
  });
}

// ── Generic pass-through email ────────────────────────────────────────────────
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const recipients = Array.isArray(to) ? to : [to];
  await sendOrThrow(client, {
    from: fromEmail,
    to: recipients,
    subject,
    html,
    ...(text ? { text } : {}),
  });
}
