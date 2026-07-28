import { emailLayout } from './email';
import { BRAND } from "@shared/brand";

const BRAND_GREEN = BRAND.theme.accentHex;
const BRAND_DARK = BRAND.theme.darkHex;
const SITE_DOMAIN = BRAND.domain;
const BRAND_NAME = BRAND.name;
const PHONE = '0800 000 0000';
const ADDRESS = 'Unit 1, Example Business Park, Your Town, AA1 1AA';

const fmt = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

const SITE_BASE = `https://${SITE_DOMAIN}`;

// ─── Shared fixture constants ──────────────────────────────────────────────────
// Single source of truth for all preview and test-send fixture data.
// Referenced by TEST_ARGS exports, generator functions, and EMAIL_TEMPLATES
// example subjects — so all three always stay in sync.

const REF = 'ABC12345';
const CUSTOMER_NAME = 'John Smith';
const CUSTOMER_EMAIL = 'john.smith@example.com';
const CUSTOMER_PHONE = '07712 345678';
const QUOTE_ID = 'abc12345-0000-0000-0000-000000000000';
const VAN_TITLE = 'Ford Transit Custom 2023 2.0 EcoBlue';
const KIT_NAME = 'Silver Pack – 8 Wheel Tyre Changer';
const UPGRADES = ['Nitrogen Generator', 'Tyre Pressure Monitoring Display', 'Heavy Duty Drawer System'];
const SUBTOTAL = 1500000;
const VAT = 300000;
const TOTAL = 1800000;
const DEPOSIT = 270000;
const TERM = 60;
const MONTHLY = 30500;
const WEEKLY = 7040;
// Chosen option used in option-chosen and quote-spec-comparison fixtures
const FIXTURE_CHOSEN_OPTION = 'B' as const;

export interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  subject: string;
  recipient: 'customer' | 'admin' | 'finance' | 'depot';
  group: 'Enquiry' | 'Spec' | 'Quote' | 'Finance' | 'Post-Sale' | 'Account';
}

/**
 * Template IDs that call the real send function when "Send Test" is clicked.
 * All other templates use the generic HTML generator (static snapshot).
 * Add new IDs here whenever a new live-send route is wired up.
 */
export const LIVE_SEND_TEMPLATE_IDS = new Set([
  'spec-summary-single',
  'spec-summary-comparison',
  'quote-confirmation',
  'enquiry-received-customer',
  'enquiry-received-admin',
  'lead-received-customer',
  'lead-received-admin',
  'option-chosen-admin',
  'quote-spec-summary-single',
  'quote-spec-summary-comparison',
  'finance-submission',
  'depot-invoice',
  'testimonial-request',
  'welcome-email',
  'set-password',
  'password-reset',
]);

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: 'enquiry-received-customer', label: 'Enquiry Received (Customer)', description: 'Sent to the customer when they complete the configurator', subject: `We've received your enquiry – Ref #${REF}`, recipient: 'customer', group: 'Enquiry' },
  { id: 'enquiry-received-admin', label: 'Enquiry Received (Internal)', description: 'Admin notification of a new configurator submission', subject: `New configurator submission – ${CUSTOMER_NAME} – ${fmt(TOTAL)} – Ref #${REF}`, recipient: 'admin', group: 'Enquiry' },
  { id: 'lead-received-customer', label: 'Lead Received (Customer)', description: 'Sent to customer when they submit a general enquiry form', subject: `We've received your enquiry – ${BRAND_NAME}`, recipient: 'customer', group: 'Enquiry' },
  { id: 'lead-received-admin', label: 'Lead Received (Internal)', description: 'Admin notification of a new general enquiry', subject: `New enquiry – ${CUSTOMER_NAME} – ${CUSTOMER_PHONE} – Ref #${REF}`, recipient: 'admin', group: 'Enquiry' },
  { id: 'spec-summary-single', label: 'Spec Summary (Single Van)', description: 'Sent to customer after admin discusses their specification', subject: `Your Van Conversion Summary – Ref #${REF} – ${BRAND_NAME}`, recipient: 'customer', group: 'Spec' },
  { id: 'spec-summary-comparison', label: 'Spec Summary (Comparison)', description: 'Spec summary with two options for the customer to choose between', subject: `Your Van Conversion Options – Ref #${REF} – ${BRAND_NAME}`, recipient: 'customer', group: 'Spec' },
  { id: 'option-chosen-admin', label: 'Option Chosen (Internal)', description: 'Admin notification when a customer selects their preferred option', subject: `Customer chose Option ${FIXTURE_CHOSEN_OPTION} – ${CUSTOMER_NAME} – Ref #${REF}`, recipient: 'admin', group: 'Spec' },
  { id: 'quote-confirmation', label: 'Quote Confirmation', description: 'Sent to customer with a formal quote and confirmation link', subject: `Your Van Conversion Quote #${REF} is Ready`, recipient: 'customer', group: 'Quote' },
  { id: 'quote-spec-summary-single', label: 'Quote Spec Summary (Single Van)', description: 'Full spec summary sent after admin call — with discount, bespoke extras, and approval buttons', subject: `Your Van Conversion Summary – Ref #${REF} – ${BRAND_NAME}`, recipient: 'customer', group: 'Quote' },
  { id: 'quote-spec-summary-comparison', label: 'Quote Spec Summary (Comparison)', description: 'Two-option A/B spec summary — shows Option B with a CHOSEN badge after the customer selects', subject: `Your Van Conversion Options – Ref #${REF} – ${BRAND_NAME}`, recipient: 'customer', group: 'Quote' },
  { id: 'finance-submission', label: 'Finance Submission', description: 'Sent to the finance company with customer and vehicle details', subject: `Finance Application – ${CUSTOMER_NAME} – ${fmt(TOTAL)} – Ref #${REF}`, recipient: 'finance', group: 'Finance' },
  { id: 'depot-invoice', label: 'Depot Invoice Request', description: 'Sent to the depot with full build spec for invoicing', subject: `Invoice Request – Quote #${REF} – ${CUSTOMER_NAME}`, recipient: 'depot', group: 'Post-Sale' },
  { id: 'testimonial-request', label: 'Review Request', description: 'Sent to customer after their conversion is complete', subject: `Would you leave us a review? – ${BRAND_NAME}`, recipient: 'customer', group: 'Post-Sale' },
  { id: 'welcome-email', label: 'New User Welcome', description: 'Sent to a new admin user with their login credentials', subject: `Your ${BRAND_NAME} account has been created`, recipient: 'admin', group: 'Account' },
  { id: 'set-password', label: 'Set Password (New User)', description: 'Sent to a new admin user with a link to set their password', subject: `You've been set up on ${BRAND_NAME} — set your password`, recipient: 'admin', group: 'Account' },
  { id: 'password-reset', label: 'Password Reset', description: 'Sent when an admin user requests a password reset', subject: `Reset your ${BRAND_NAME} password`, recipient: 'admin', group: 'Account' },
];

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

// ─── TEST_ARGS exports ─────────────────────────────────────────────────────────
// These are consumed both by the send-test route (real sends) and by the
// generateXxx() preview functions below, keeping both always in sync.

export const ENQUIRY_RECEIVED_TEST_ARGS = {
  quote: {
    id: QUOTE_ID,
    userName: CUSTOMER_NAME,
    email: CUSTOMER_EMAIL,
    phone: CUSTOMER_PHONE,
    company: 'Smith Tyres Ltd',
    estTotal: TOTAL,
    estSubtotal: SUBTOTAL,
    estVAT: VAT,
    estDiscount: null,
  },
  vanTitle: VAN_TITLE,
  kitName: KIT_NAME,
  upgradeNames: [...UPGRADES],
  financeInfoA: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
  baseUrl: SITE_BASE,
};

export const LEAD_RECEIVED_TEST_ARGS = {
  id: QUOTE_ID,
  name: CUSTOMER_NAME,
  email: CUSTOMER_EMAIL,
  phone: CUSTOMER_PHONE,
  message: "I'm interested in a mobile tyre van for my business. Could you please provide more information about your conversion packages and pricing?",
};

export const SPEC_SUMMARY_TEST_ARGS = {
  single: {
    customerName: CUSTOMER_NAME,
    quoteId: QUOTE_ID,
    vanTitle: VAN_TITLE,
    kitName: KIT_NAME,
    upgradeNames: [...UPGRADES],
    subtotal: SUBTOTAL,
    vat: VAT,
    total: TOTAL,
    customerNote: "We've taken into account your preference for a manual racking system. This has been reflected in the specification above.",
    approvalToken: 'sample-token',
    financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
    customExtras: [
      { id: 'e1', description: 'Custom livery wrap', pricePence: 85000 },
    ],
  },
  comparison: {
    customerName: CUSTOMER_NAME,
    quoteId: QUOTE_ID,
    vanTitle: VAN_TITLE,
    kitName: KIT_NAME,
    upgradeNames: [...UPGRADES],
    subtotal: SUBTOTAL,
    vat: VAT,
    total: TOTAL,
    customerNote: 'Option B includes our premium racking system which gives you more storage capacity for a busy mobile operation.',
    financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
    comparisonSlotB: {
      vanTitle: 'Mercedes-Benz Sprinter 316 CDi 2023',
      kitName: 'Gold Pack – 10 Wheel Tyre Changer',
      upgradeNames: [...UPGRADES],
      estSubtotal: 1300000,
      estVAT: 260000,
      estTotal: 1560000,
      financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: 27800, weeklyPayment: 6420 },
    },
  },
};

export const OPTION_CHOSEN_ADMIN_TEST_ARGS = {
  quoteId: QUOTE_ID,
  customerName: CUSTOMER_NAME,
  customerEmail: CUSTOMER_EMAIL,
  customerPhone: CUSTOMER_PHONE,
  chosenOption: FIXTURE_CHOSEN_OPTION,
  optionDetails: {
    vanTitle: 'Mercedes-Benz Sprinter 316 CDi 2023',
    kitName: 'Gold Pack – 10 Wheel Tyre Changer',
    upgradeNames: [...UPGRADES],
    estTotal: 1560000,
  },
};

export const QUOTE_CONFIRMATION_TEST_ARGS = {
  customerName: CUSTOMER_NAME,
  quoteId: QUOTE_ID,
  confirmationUrl: `${SITE_BASE}/quote/confirm/sample-token`,
  totalPrice: TOTAL - 50000,
  discount: 50000,
  customerNotes: "We've applied your loyalty discount and have matched the finance rate you enquired about. Looking forward to getting you on the road!",
};

export const QUOTE_SPEC_SUMMARY_TEST_ARGS = {
  single: {
    customerName: CUSTOMER_NAME,
    quoteId: QUOTE_ID,
    vanTitle: VAN_TITLE,
    kitName: KIT_NAME,
    upgradeNames: [...UPGRADES],
    subtotal: SUBTOTAL,
    vat: VAT,
    total: TOTAL,
    discount: 50000,
    customerNote: "We've applied a loyalty discount and factored in your preference for a manual racking system. This is reflected in the specification above.",
    approvalToken: 'sample-token',
    financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
    customExtras: [
      { id: 'e1', description: 'Custom livery wrap', pricePence: 85000 },
      { id: 'e2', description: 'Roof rack system', pricePence: 42000 },
    ],
  },
  comparison: {
    customerName: CUSTOMER_NAME,
    quoteId: QUOTE_ID,
    vanTitle: VAN_TITLE,
    kitName: KIT_NAME,
    upgradeNames: [...UPGRADES],
    subtotal: SUBTOTAL,
    vat: VAT,
    total: TOTAL,
    customerNote: 'Option B includes our premium racking system which gives you more storage capacity for a busy mobile operation.',
    financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
    comparisonSlotB: {
      vanTitle: 'Mercedes-Benz Sprinter 316 CDi 2023',
      kitName: 'Gold Pack – 10 Wheel Tyre Changer',
      upgradeNames: ['Nitrogen Generator', 'Heavy Duty Drawer System', 'Wheel Balancer Upgrade'],
      estSubtotal: 1300000,
      estVAT: 260000,
      estTotal: 1560000,
      financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: 27800, weeklyPayment: 6420 },
    },
    chosenOption: FIXTURE_CHOSEN_OPTION,
  },
};

export const FINANCE_SUBMISSION_TEST_ARGS = {
  customerName: CUSTOMER_NAME,
  customerPhone: CUSTOMER_PHONE,
  customerEmail: CUSTOMER_EMAIL,
  quoteId: QUOTE_ID,
  vanTitle: VAN_TITLE,
  vanRegistration: 'AB23 CDE',
  vanMileage: 14500,
  kitName: KIT_NAME,
  upgradeNames: [...UPGRADES],
  subtotal: SUBTOTAL,
  vat: VAT,
  total: TOTAL,
  discount: 50000,
  customExtras: [
    { id: 'e1', description: 'Custom livery wrap', pricePence: 85000 },
  ],
  financeDetails: {
    planType: 'HP',
    apr: 10.9,
    depositAmount: DEPOSIT,
    termMonths: TERM,
    monthlyPayment: MONTHLY,
    weeklyPayment: WEEKLY,
  },
};

export const DEPOT_INVOICE_TEST_ARGS = {
  quoteId: QUOTE_ID,
  customerName: CUSTOMER_NAME,
  customerPhone: CUSTOMER_PHONE,
  customerEmail: CUSTOMER_EMAIL,
  vanDetails: {
    title: VAN_TITLE,
    registration: 'AB23 CDE',
    mileage: 14500,
    transmission: 'Manual',
    fuelType: 'Diesel',
  },
  kitName: KIT_NAME,
  upgradeNames: [...UPGRADES],
  customExtras: [
    { id: 'e1', description: 'Custom livery wrap', pricePence: 85000 },
  ],
  subtotal: SUBTOTAL,
  vat: VAT,
  discount: 50000,
  total: TOTAL,
  financeInfo: { depositAmount: DEPOSIT, termMonths: TERM, monthlyPayment: MONTHLY, weeklyPayment: WEEKLY },
};

export const TESTIMONIAL_REQUEST_TEST_ARGS = {
  customerName: CUSTOMER_NAME,
  reviewUrl: 'https://g.page/r/sample-review-link',
};

export const WELCOME_EMAIL_TEST_ARGS = {
  firstName: 'John',
  username: 'john.smith',
  password: 'Temp@Password1',
  loginUrl: `${SITE_BASE}/admin/login`,
};

export const SET_PASSWORD_TEST_ARGS = {
  firstName: 'John',
  username: 'john.smith',
  setPasswordUrl: `${SITE_BASE}/admin/set-password/sample-token`,
};

export const PASSWORD_RESET_TEST_ARGS = {
  firstName: 'John',
  username: 'john.smith',
  resetUrl: `${SITE_BASE}/admin/reset-password/sample-token`,
};

// ─── Preview generators ────────────────────────────────────────────────────────
// Each function pulls its fixture data exclusively from the corresponding
// TEST_ARGS export above, so previews and test-sends always use identical data.

function generateEnquiryReceivedCustomer(): string {
  const { quote, vanTitle, kitName, upgradeNames, financeInfoA } = ENQUIRY_RECEIVED_TEST_ARGS;
  const ref = quote.id.slice(0, 8).toUpperCase();
  const upgradesList = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const body = `
    <p>Hi ${quote.userName},</p>
    <p>Thank you for completing our van configurator. We've received your enquiry and one of our team will be in touch within 24 hours to discuss your requirements.</p>
    <div class="ref-box">
      <p><strong>Your reference number:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    <h3 style="margin-bottom: 8px;">Your Configuration Summary</h3>
    <table class="summary">
      <tr><td>Van</td><td>${vanTitle}</td></tr>
      <tr><td>Pack</td><td>${kitName}</td></tr>
      <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
      <tr><td>Subtotal</td><td>${fmt(quote.estSubtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(quote.estVAT)}</td></tr>
      <tr class="total-row"><td>Total</td><td>${fmt(quote.estTotal)}</td></tr>
      ${financeInfoA ? `
      <tr><td colspan="2" style="padding-top:12px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
      <tr><td style="color:#6b7280;">Deposit</td><td>${fmt(financeInfoA.depositAmount)}</td></tr>
      <tr><td style="color:#6b7280;">Term</td><td>${financeInfoA.termMonths} months (5 years)</td></tr>
      <tr><td style="color:#6b7280;">Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">${fmt(financeInfoA.monthlyPayment)}/month</td></tr>
      <tr><td style="color:#6b7280;">Est. Weekly</td><td>${fmt(financeInfoA.weeklyPayment)}/week (approx.)</td></tr>
      ` : ''}
    </table>
    <p>If you have any questions in the meantime, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: `
      .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
      .ref-box p { margin: 0; }
      .summary { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .summary td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
      .summary td:first-child { color: #6b7280; width: 40%; }
      .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
    `,
    footerNote: 'If you did not submit this enquiry, please disregard this email.',
  });
}

function generateEnquiryReceivedAdmin(): string {
  const { quote, vanTitle, kitName, upgradeNames, financeInfoA } = ENQUIRY_RECEIVED_TEST_ARGS;
  const ref = quote.id.slice(0, 8).toUpperCase();
  const upgradesList = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const body = `
    <h2 style="color:${BRAND_DARK}; border-bottom: 3px solid ${BRAND_GREEN}; padding-bottom: 8px;">New Configurator Submission</h2>
    <h3>Customer Details</h3>
    <table>
      <tr><td>Name</td><td>${quote.userName}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${quote.email}">${quote.email}</a></td></tr>
      <tr><td>Phone</td><td>${quote.phone}</td></tr>
      <tr><td>Company</td><td>${quote.company}</td></tr>
      <tr><td>Reference</td><td>#${ref}</td></tr>
    </table>
    <h3>Configuration</h3>
    <table>
      <tr><td>Van</td><td>${vanTitle}</td></tr>
      <tr><td>Pack</td><td>${kitName}</td></tr>
      <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
    </table>
    <h3>Pricing</h3>
    <table>
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(quote.estSubtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(quote.estVAT)}</td></tr>
      <tr class="total"><td>Total (inc. VAT)</td><td>${fmt(quote.estTotal)}</td></tr>
      ${financeInfoA ? `
      <tr><td colspan="2" style="padding-top:10px;padding-bottom:4px;font-weight:bold;font-size:13px;color:${BRAND_DARK};border-top:2px solid #e5e7eb;">Finance Illustration (HP — 10.9% APR)</td></tr>
      <tr><td>Deposit</td><td>${fmt(financeInfoA.depositAmount)}</td></tr>
      <tr><td>Term</td><td>${financeInfoA.termMonths} months (5 years)</td></tr>
      <tr><td>Est. Monthly</td><td style="font-weight:bold;color:${BRAND_GREEN};">${fmt(financeInfoA.monthlyPayment)}/month</td></tr>
      <tr><td>Est. Weekly</td><td>${fmt(financeInfoA.weeklyPayment)}/week (approx.)</td></tr>
      ` : ''}
    </table>
  `;
  return emailLayout(body, {
    extraCss: `
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
      td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
      .total td { font-weight: bold; font-size: 16px; border-top: 2px solid ${BRAND_GREEN}; }
    `,
  });
}

function generateLeadReceivedCustomer(): string {
  const { id, name, message } = LEAD_RECEIVED_TEST_ARGS;
  const ref = id.slice(0, 8).toUpperCase();
  const body = `
    <p>Hi ${name},</p>
    <p>Thank you for getting in touch with ${BRAND_NAME}. We've received your enquiry and one of our team will be in touch with you shortly.</p>
    <div class="ref-box">
      <p><strong>Your reference number:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    ${message ? `<p><strong>Your message:</strong><br><em>"${message}"</em></p>` : ''}
    <p>If you need to speak to us urgently, please call <strong>${PHONE}</strong>.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: `
      .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
      .ref-box p { margin: 0; }
    `,
    footerNote: 'If you did not submit this enquiry, please disregard this email.',
  });
}

function generateLeadReceivedAdmin(): string {
  const { id, name, email, phone, message } = LEAD_RECEIVED_TEST_ARGS;
  const ref = id.slice(0, 8).toUpperCase();
  const body = `
    <h2 style="color:${BRAND_DARK}; border-bottom: 3px solid ${BRAND_GREEN}; padding-bottom: 8px;">New Enquiry Received</h2>
    <table>
      <tr><td>Name</td><td>${name}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
      ${phone ? `<tr><td>Phone</td><td>${phone}</td></tr>` : ''}
      <tr><td>Reference</td><td>#${ref}</td></tr>
    </table>
    ${message ? `<p><strong>Message:</strong></p><div class="message-box">${message}</div>` : '<p><em>No message provided.</em></p>'}
  `;
  return emailLayout(body, {
    extraCss: `
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
      td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
      .message-box { background: #f9fafb; padding: 15px; border-radius: 4px; border-left: 4px solid ${BRAND_GREEN}; margin-top: 16px; white-space: pre-wrap; font-size: 14px; }
    `,
  });
}

function generateSpecSummarySingle(): string {
  const { customerName, quoteId, vanTitle, kitName, upgradeNames, subtotal, vat, total, customerNote, approvalToken, financeInfo, customExtras } = SPEC_SUMMARY_TEST_ARGS.single;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const upgradesList = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const extrasList = customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} — ${fmt(e.pricePence)}</li>`).join('');
  const body = `
    <p>Hi ${customerName},</p>
    <p>Thank you for speaking with us today. As discussed, please find below a summary of your configured mobile tyre van conversion.</p>
    <div class="ref-box">
      <p><strong>Reference:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    <h3 style="margin-bottom:8px;">Your Configuration</h3>
    <table>
      <tr><td>Van</td><td>${vanTitle}</td></tr>
      <tr><td>Pack</td><td>${kitName}</td></tr>
      <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
      ${extrasList ? `<tr><td>Bespoke Extras</td><td><ul style="margin:2px 0;padding-left:18px;">${extrasList}</ul></td></tr>` : ''}
    </table>
    <h3 style="margin-bottom:8px;">Pricing</h3>
    <table>
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(total)}</td></tr>
    </table>
    ${financeInfo ? `
    <h3 style="margin-bottom:8px; margin-top:24px;">Finance Option (HP — 10.9% APR)</h3>
    <table>
      <tr><td>Deposit</td><td>${fmt(financeInfo.depositAmount)}</td></tr>
      <tr><td>Finance Term</td><td>${financeInfo.termMonths} months (5 years)</td></tr>
      <tr><td>Estimated Monthly Payment</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(financeInfo.monthlyPayment)}/month</td></tr>
      <tr><td>Estimated Weekly Payment</td><td>${fmt(financeInfo.weeklyPayment)}/week (approx.)</td></tr>
    </table>
    <p style="font-size:12px; color:#6b7280; margin-top:-8px;">Finance figures are estimates based on Hire Purchase at 10.9% APR. Subject to status and final agreement.</p>
    ` : ''}
    ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
    <div style="margin: 28px 0; padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center;">
      <p style="font-size: 15px; font-weight: bold; margin: 0 0 6px;">Does this look correct?</p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">Please let us know whether the spec above is right, or if anything needs changing.</p>
      <a href="${SITE_BASE}/spec-approval/${approvalToken}?status=approved"
         style="display:block; max-width:280px; margin:0 auto 12px; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; text-align:center; box-sizing:border-box;">
        This looks correct
      </a>
      <a href="${SITE_BASE}/spec-approval/${approvalToken}?status=rejected"
         style="display:block; max-width:280px; margin:0 auto; background:#fff; color:#374151; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; border:1px solid #d1d5db; text-align:center; box-sizing:border-box;">
        Something needs changing
      </a>
    </div>
    <p>If you have any questions or would like to make changes, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: specTableCss,
    footerNote: 'If you did not request this summary, please disregard this email.',
  });
}

function generateSpecSummaryComparison(): string {
  const { customerName, quoteId, vanTitle, kitName, upgradeNames, subtotal, vat, total, customerNote, financeInfo, comparisonSlotB } = SPEC_SUMMARY_TEST_ARGS.comparison;
  const ref = quoteId.slice(0, 8).toUpperCase();

  const optionBlock = (opt: 'A' | 'B', van: string, kit: string, upgrades: string[], sub: number, v: number, tot: number, fi: { depositAmount: number; termMonths: number; monthlyPayment: number; weeklyPayment: number }) => {
    const upgradesList = upgrades.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
    return `
    <div style="border:1px solid #e5e7eb; border-radius:6px; padding:20px; margin-bottom:20px; background:#fff;">
      <p style="font-weight:bold; font-size:15px; margin:0 0 12px; color:${BRAND_DARK};">Option ${opt}</p>
      <table>
        <tr><td>Van</td><td>${van}</td></tr>
        <tr><td>Pack</td><td>${kit}</td></tr>
        <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
        <tr><td>Subtotal (ex. VAT)</td><td>${fmt(sub)}</td></tr>
        <tr><td>VAT (20%)</td><td>${fmt(v)}</td></tr>
        <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(tot)}</td></tr>
      </table>
      <h4 style="margin:12px 0 6px; color:#374151; font-size:13px;">Finance Option (HP — 10.9% APR)</h4>
      <table>
        <tr><td>Deposit</td><td>${fmt(fi.depositAmount)}</td></tr>
        <tr><td>Finance Term</td><td>${fi.termMonths} months (5 years)</td></tr>
        <tr><td>Monthly Payment (est.)</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(fi.monthlyPayment)}/month</td></tr>
        <tr><td>Weekly Payment (est.)</td><td>${fmt(fi.weeklyPayment)}/week</td></tr>
      </table>
      <div style="text-align:center; margin-top:16px;">
        <a href="${SITE_BASE}/api/quotes/${quoteId}/choose-option?option=${opt}"
           style="display:block;max-width:240px;margin:0 auto;background:${BRAND_GREEN};color:${BRAND_DARK};font-weight:bold;font-size:15px;padding:13px 24px;border-radius:4px;text-decoration:none;text-align:center;box-sizing:border-box;">
          I choose Option ${opt}
        </a>
      </div>
    </div>`;
  };

  const body = `
    <p>Hi ${customerName},</p>
    <p>We've prepared two options for you to compare. Please review both below and click the button under the one you'd like to go ahead with — we'll be notified straight away.</p>
    <div class="ref-box">
      <p><strong>Reference:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    ${optionBlock('A', vanTitle, kitName, upgradeNames, subtotal, vat, total, financeInfo)}
    ${optionBlock('B', comparisonSlotB.vanTitle, comparisonSlotB.kitName, comparisonSlotB.upgradeNames, comparisonSlotB.estSubtotal, comparisonSlotB.estVAT, comparisonSlotB.estTotal, comparisonSlotB.financeInfo)}
    ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
    <p>If you have any questions, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: specTableCss,
    footerNote: 'If you did not request this summary, please disregard this email.',
  });
}

function generateOptionChosenAdmin(): string {
  const { quoteId, customerName, customerEmail, customerPhone, chosenOption, optionDetails } = OPTION_CHOSEN_ADMIN_TEST_ARGS;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const upgradesList = optionDetails.upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const body = `
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
      <tr><td>Van</td><td>${optionDetails.vanTitle}</td></tr>
      <tr><td>Pack</td><td>${optionDetails.kitName}</td></tr>
      <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
      <tr class="total"><td>Total (inc. VAT)</td><td>${fmt(optionDetails.estTotal)}</td></tr>
    </table>
    <p style="margin-top:16px;font-size:13px;color:#6b7280;">Log in to the admin panel to view the full quote and continue the build process.</p>
  `;
  return emailLayout(body, {
    extraCss: `
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
      td:first-child { font-weight: bold; color: #6b7280; width: 35%; }
      .total td { font-weight: bold; font-size: 15px; border-top: 2px solid ${BRAND_GREEN}; }
    `,
  });
}

function generateQuoteConfirmation(): string {
  const { customerName, quoteId, confirmationUrl, totalPrice, discount, customerNotes } = QUOTE_CONFIRMATION_TEST_ARGS;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const body = `
    <p>Hi ${customerName},</p>
    <p>Thank you for requesting a quote for your mobile tyre van conversion. We've reviewed your configuration and are pleased to present your custom quote.</p>
    <div class="price-box">
      <h2 style="margin-top: 0;">Quote #${ref}</h2>
      ${discount ? `<div class="savings">Special Discount Applied — You Save ${fmt(discount)}!</div>` : ''}
      <p style="font-size: 28px; font-weight: bold; color: ${BRAND_GREEN}; margin: 10px 0;">${fmt(totalPrice)}</p>
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
  return emailLayout(body, {
    extraCss: `
      .price-box { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .cta-btn { display: block; max-width: 280px; margin: 20px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; box-sizing: border-box; }
      .savings { background-color: #dcfce7; color: #166534; padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: bold; }
      .note-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
      @media screen and (max-width: 600px) { .cta-btn { max-width: 100% !important; } }
    `,
    footerNote: "If you didn't request this quote, please disregard this email.",
  });
}

function generateFinanceSubmission(): string {
  const { customerName, customerPhone, customerEmail, quoteId, vanTitle, vanRegistration, vanMileage, kitName, upgradeNames, subtotal, vat, total, financeDetails } = FINANCE_SUBMISSION_TEST_ARGS;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const rows = upgradeNames.map(u => `<tr><td style="color:#111;font-weight:500;">Upgrade</td><td>${u}</td></tr>`).join('');
  const body = `
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
      <tr><td>Van</td><td>${vanTitle}</td></tr>
      <tr><td>Registration</td><td><strong>${vanRegistration}</strong></td></tr>
      <tr><td>Mileage</td><td>${vanMileage.toLocaleString('en-GB')} miles</td></tr>
    </table>

    <div class="section-title">Conversion Specification (ex. VAT)</div>
    <table>
      <tr><td style="color:#111;font-weight:500;">Equipment Pack</td><td>${kitName}</td></tr>
      ${rows}
    </table>

    <div class="section-title">Pricing</div>
    <table>
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(total)}</td></tr>
    </table>

    <div class="section-title">Finance Details</div>
    <table>
      <tr><td>Plan Type</td><td>${financeDetails.planType === 'HP' ? 'Hire Purchase (HP)' : financeDetails.planType}</td></tr>
      <tr><td>APR</td><td>${financeDetails.apr.toFixed(2)}%</td></tr>
      <tr><td>Deposit</td><td>${fmt(financeDetails.depositAmount)}</td></tr>
      <tr><td>Term</td><td>${financeDetails.termMonths} months</td></tr>
      <tr><td>Monthly Payment</td><td>${fmt(financeDetails.monthlyPayment)}</td></tr>
      <tr><td>Weekly Payment</td><td>${fmt(financeDetails.weeklyPayment)}</td></tr>
    </table>

    <p style="margin-top:24px;">Please contact the customer directly to progress the finance application. If you have any questions, please reply to this email or call us on <strong>${PHONE}</strong>.</p>
    <p>Kind regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    maxWidth: 650,
    extraCss: `
      .section-title { font-size: 14px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid ${BRAND_GREEN}; padding-bottom: 6px; margin: 24px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
      td:first-child { color: #6b7280; width: 40%; font-weight: 500; }
      .total-row td { font-weight: bold; font-size: 17px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
      .total-row td:last-child { color: ${BRAND_GREEN}; }
      .ref-pill { display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 12px; font-family: monospace; font-size: 14px; font-weight: bold; }
    `,
  });
}

function generateDepotInvoice(): string {
  const { quoteId, customerName, customerPhone, customerEmail, vanDetails, kitName, upgradeNames, customExtras, subtotal, vat, total, financeInfo } = DEPOT_INVOICE_TEST_ARGS;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const upgradesList = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const extrasList = customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} — ${fmt(e.pricePence)}</li>`).join('');
  const body = `
    <div class="ref-box">Invoice Request — Quote <strong>#${ref}</strong></div>

    <div class="section-title">Customer</div>
    <table>
      <tr><td>Name</td><td>${customerName}</td></tr>
      <tr><td>Phone</td><td>${customerPhone}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${customerEmail}">${customerEmail}</a></td></tr>
    </table>

    <div class="section-title">Van Details</div>
    <table>
      <tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">${vanDetails.title}</td></tr>
      <tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">Reg: ${vanDetails.registration}</td></tr>
      <tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">Mileage: ${vanDetails.mileage.toLocaleString('en-GB')} miles</td></tr>
      <tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">Transmission: ${vanDetails.transmission}</td></tr>
      <tr><td colspan="2" style="padding:5px 12px; font-size:14px; color:#374151;">Fuel: ${vanDetails.fuelType}</td></tr>
    </table>

    <div class="section-title">Build Specification</div>
    <table>
      <tr><td style="font-weight:500;">Conversion Pack</td><td>${kitName}</td></tr>
      <tr><td style="font-weight:500;">Upgrades</td><td><ul style="margin:4px 0; padding-left:18px;">${upgradesList}</ul></td></tr>
      ${extrasList ? `<tr><td style="font-weight:500;">Bespoke Extras</td><td><ul style="margin:4px 0; padding-left:18px;">${extrasList}</ul></td></tr>` : ''}
    </table>

    <div class="section-title">Pricing</div>
    <table>
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(total)}</td></tr>
      ${financeInfo ? `
      <tr><td colspan="2" style="padding:10px 12px 4px; font-weight:bold; font-size:13px; color:${BRAND_DARK}; border-top:1px solid #e5e7eb;">Finance (HP – 10.9% APR est.)</td></tr>
      <tr><td>Deposit</td><td>${fmt(financeInfo.depositAmount)}</td></tr>
      <tr><td>Term</td><td>${financeInfo.termMonths} months (5 yr)</td></tr>
      <tr><td>Monthly (est.)</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(financeInfo.monthlyPayment)}/month</td></tr>
      <tr><td>Weekly (est.)</td><td>${fmt(financeInfo.weeklyPayment)}/week</td></tr>
      ` : ''}
    </table>
  `;
  return emailLayout(body, {
    maxWidth: 620,
    extraCss: `
      .ref-box { background: #f3f4f6; border-left: 4px solid ${BRAND_GREEN}; padding: 12px 18px; border-radius: 4px; margin-bottom: 20px; font-size: 15px; }
      .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 20px 0 6px; }
      table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; word-break: break-word; }
      td:first-child { color: #6b7280; width: 38%; }
      .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid ${BRAND_GREEN}; border-bottom: none; }
      .total-row td:last-child { color: ${BRAND_GREEN}; }
    `,
  });
}

function generateTestimonialRequest(): string {
  const { customerName, reviewUrl } = TESTIMONIAL_REQUEST_TEST_ARGS;
  const body = `
    <p>Hi ${customerName},</p>
    <p>Thank you for choosing ${BRAND_NAME}. We hope you're delighted with your new mobile tyre van.</p>
    <p>We'd be really grateful if you could spare 2 minutes to leave us a quick review. It helps other people make confident decisions and means a lot to our team.</p>
    <div class="stars">&#9733; &#9733; &#9733; &#9733; &#9733;</div>
    <div style="text-align:center;">
      <a href="${reviewUrl}" class="cta-btn">Leave a review</a>
    </div>
    <p style="font-size: 13px; color: #6b7280; text-align: center; margin-top:12px;">Or copy this link into your browser:<br />${reviewUrl}</p>
  `;
  return emailLayout(body, {
    extraCss: `
      .cta-btn { display: block; max-width: 260px; margin: 24px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; box-sizing: border-box; }
      .stars { font-size: 28px; letter-spacing: 4px; text-align: center; margin: 16px 0; color: ${BRAND_GREEN}; }
    `,
    footerNote: 'This link is personal to you and can only be used once.',
  });
}

function generateWelcomeEmail(): string {
  const { firstName, username, password, loginUrl } = WELCOME_EMAIL_TEST_ARGS;
  const displayName = firstName || username;
  const body = `
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
  return emailLayout(body, {
    extraCss: `
      .credentials-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px 24px; margin: 20px 0; }
      .credentials-box table { width: 100%; border-collapse: collapse; }
      .credentials-box td { padding: 6px 0; font-size: 15px; }
      .credentials-box td:first-child { color: #6b7280; width: 38%; font-weight: 500; }
      .credentials-box td:last-child { font-weight: bold; font-family: monospace; font-size: 15px; }
      .cta-btn { display: block; max-width: 240px; margin: 16px auto; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 13px 28px; border-radius: 4px; font-weight: bold; font-size: 15px; text-align: center; box-sizing: border-box; }
    `,
    footerNote: `If you did not expect this email, please contact us immediately on ${PHONE}.`,
  });
}

function generateSetPassword(): string {
  const { firstName, username, setPasswordUrl } = SET_PASSWORD_TEST_ARGS;
  const displayName = firstName || username;
  const body = `
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
  return emailLayout(body, {
    extraCss: `
      .info-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px 24px; margin: 20px 0; }
      .info-box table { width: 100%; border-collapse: collapse; }
      .info-box td { padding: 6px 0; font-size: 15px; }
      .info-box td:first-child { color: #6b7280; width: 38%; font-weight: 500; }
      .info-box td:last-child { font-weight: bold; }
      .cta-btn { display: inline-block; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-weight: bold; font-size: 16px; margin: 20px 0; }
      .expiry-note { color: #6b7280; font-size: 13px; margin-top: 0; }
    `,
    footerNote: `If you did not expect this email, please contact us on ${PHONE}.`,
  });
}

function generatePasswordReset(): string {
  const { firstName, username, resetUrl } = PASSWORD_RESET_TEST_ARGS;
  const displayName = firstName || username;
  const body = `
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
  return emailLayout(body, {
    extraCss: `
      .cta-btn { display: inline-block; background-color: ${BRAND_GREEN}; color: ${BRAND_DARK}; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-weight: bold; font-size: 15px; margin: 20px 0; }
      .url-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #374151; }
    `,
    footerNote: `If you need help, call us on ${PHONE}.`,
  });
}

function generateQuoteSpecSummarySingle(): string {
  const { customerName, quoteId, vanTitle, kitName, upgradeNames, subtotal, vat, total, discount, customerNote, approvalToken, financeInfo, customExtras } = QUOTE_SPEC_SUMMARY_TEST_ARGS.single;
  const ref = quoteId.slice(0, 8).toUpperCase();
  const totalAfterDiscount = discount ? total - discount : total;
  const upgradesList = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const extrasList = customExtras.map(e => `<li style="margin-bottom:2px;">${e.description} — ${fmt(e.pricePence)}</li>`).join('');
  const body = `
    <p>Hi ${customerName},</p>
    <p>Thank you for speaking with us today. As discussed, please find below a summary of your configured mobile tyre van conversion.</p>
    <div class="ref-box">
      <p><strong>Reference:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    <h3 style="margin-bottom:8px;">Your Configuration</h3>
    <table>
      <tr><td>Van</td><td>${vanTitle}</td></tr>
      <tr><td>Pack</td><td>${kitName}</td></tr>
      <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
      ${extrasList ? `<tr><td>Bespoke Extras</td><td><ul style="margin:2px 0;padding-left:18px;">${extrasList}</ul></td></tr>` : ''}
    </table>
    <h3 style="margin-bottom:8px;">Pricing</h3>
    <table>
      ${discount ? `
      <tr><td>Original Price (inc. VAT)</td><td>${fmt(total)}</td></tr>
      <tr><td style="color:#166534;">Discount</td><td style="color:#166534;">-${fmt(discount)}</td></tr>
      ` : ''}
      <tr><td>Subtotal (ex. VAT)</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>VAT (20%)</td><td>${fmt(vat)}</td></tr>
      <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(totalAfterDiscount)}</td></tr>
    </table>
    ${financeInfo ? `
    <h3 style="margin-bottom:8px; margin-top:24px;">Finance Option (HP — 10.9% APR)</h3>
    <table>
      <tr><td>Deposit</td><td>${fmt(financeInfo.depositAmount)}</td></tr>
      <tr><td>Finance Term</td><td>${financeInfo.termMonths} months (5 years)</td></tr>
      <tr><td>Estimated Monthly Payment</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(financeInfo.monthlyPayment)}/month</td></tr>
      <tr><td>Estimated Weekly Payment</td><td>${fmt(financeInfo.weeklyPayment)}/week (approx.)</td></tr>
    </table>
    <p style="font-size:12px; color:#6b7280; margin-top:-8px;">Finance figures are estimates based on Hire Purchase at 10.9% APR. Subject to status and final agreement.</p>
    ` : ''}
    ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
    <div style="margin: 28px 0; padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center;">
      <p style="font-size: 15px; font-weight: bold; margin: 0 0 6px;">Does this look correct?</p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">Please let us know whether the spec above is right, or if anything needs changing.</p>
      <a href="${SITE_BASE}/spec-approval/${approvalToken}?status=approved"
         style="display:block; max-width:280px; margin:0 auto 12px; background:${BRAND_GREEN}; color:${BRAND_DARK}; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; text-align:center; box-sizing:border-box;">
        This looks correct
      </a>
      <a href="${SITE_BASE}/spec-approval/${approvalToken}?status=rejected"
         style="display:block; max-width:280px; margin:0 auto; background:#fff; color:#374151; font-weight:bold; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:4px; border:1px solid #d1d5db; text-align:center; box-sizing:border-box;">
        Something needs changing
      </a>
    </div>
    <p>If you have any questions or would like to make changes, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: specTableCss,
    footerNote: 'If you did not request this summary, please disregard this email.',
  });
}

function generateQuoteSpecSummaryComparison(): string {
  const { customerName, quoteId, vanTitle, kitName, upgradeNames, subtotal, vat, total, customerNote, financeInfo, comparisonSlotB, chosenOption } = QUOTE_SPEC_SUMMARY_TEST_ARGS.comparison;
  const ref = quoteId.slice(0, 8).toUpperCase();

  const chosenBadge = (opt: 'A' | 'B') =>
    chosenOption === opt
      ? ` <span style="background:${BRAND_GREEN};color:${BRAND_DARK};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:bold;vertical-align:middle;">CHOSEN</span>`
      : '';

  type FinanceInfo = { depositAmount: number; termMonths: number; monthlyPayment: number; weeklyPayment: number };
  const optionBlock = (
    opt: 'A' | 'B',
    vanTitle: string,
    kitName: string,
    upgradesList: string,
    sub: number,
    v: number,
    tot: number,
    fi: FinanceInfo,
  ) => {
    const isChosen = chosenOption === opt;
    const borderStyle = isChosen ? `border:2px solid ${BRAND_GREEN};` : 'border:1px solid #e5e7eb;';
    return `
      <div style="${borderStyle} border-radius:6px; padding:20px; margin-bottom:20px; background:#fff;">
        <p style="font-weight:bold; font-size:15px; margin:0 0 12px; color:${BRAND_DARK};">
          Option ${opt}${chosenBadge(opt)}
        </p>
        <table>
          <tr><td>Van</td><td>${vanTitle}</td></tr>
          <tr><td>Pack</td><td>${kitName}</td></tr>
          <tr><td>Upgrades</td><td><ul style="margin:2px 0;padding-left:18px;">${upgradesList}</ul></td></tr>
          <tr><td>Subtotal (ex. VAT)</td><td>${fmt(sub)}</td></tr>
          <tr><td>VAT (20%)</td><td>${fmt(v)}</td></tr>
          <tr class="total-row"><td>Total (inc. VAT)</td><td>${fmt(tot)}</td></tr>
        </table>
        <h4 style="margin:12px 0 6px; color:#374151; font-size:13px;">Finance Option (HP — 10.9% APR)</h4>
        <table>
          <tr><td>Deposit</td><td>${fmt(fi.depositAmount)}</td></tr>
          <tr><td>Finance Term</td><td>${fi.termMonths} months (5 years)</td></tr>
          <tr><td>Monthly Payment (est.)</td><td style="font-weight:bold; color:${BRAND_GREEN};">${fmt(fi.monthlyPayment)}/month</td></tr>
          <tr><td>Weekly Payment (est.)</td><td>${fmt(fi.weeklyPayment)}/week</td></tr>
        </table>
      </div>`;
  };

  const upgradesListA = upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');
  const upgradesListB = comparisonSlotB.upgradeNames.map(u => `<li style="margin-bottom:2px;">${u}</li>`).join('');

  const chosenConfirmBlock = chosenOption ? `
    <div style="margin:24px 0; padding:20px; background:#f0fdf4; border:2px solid ${BRAND_GREEN}; border-radius:6px; text-align:center;">
      <p style="font-size:16px; font-weight:bold; color:#166534; margin:0 0 6px;">Option ${chosenOption} selected</p>
      <p style="font-size:13px; color:#166534; margin:0;">Our team will be in touch to confirm your order. Call us on <strong>${PHONE}</strong> if you have any questions.</p>
    </div>` : '';

  const intro = chosenOption
    ? `<p>You have selected <strong>Option ${chosenOption}</strong> as your final choice. Our team will be in touch shortly to confirm next steps.</p>`
    : `<p>We've prepared two options for you to compare. Please review both below and click the button under the one you'd like to go ahead with — we'll be notified straight away.</p>`;

  const body = `
    <p>Hi ${customerName},</p>
    ${intro}
    <div class="ref-box">
      <p><strong>Reference:</strong> #${ref}</p>
      <p style="margin-top:6px; color:#6b7280; font-size:13px;">Please quote this reference in any correspondence with us.</p>
    </div>
    ${chosenConfirmBlock}
    ${optionBlock('A', vanTitle, kitName, upgradesListA, subtotal, vat, total, financeInfo)}
    ${optionBlock('B', comparisonSlotB.vanTitle, comparisonSlotB.kitName, upgradesListB, comparisonSlotB.estSubtotal, comparisonSlotB.estVAT, comparisonSlotB.estTotal, comparisonSlotB.financeInfo)}
    ${customerNote ? `<div class="note-box"><strong>Note from our team:</strong><br>${customerNote}</div>` : ''}
    <p>If you have any questions, please call us on <strong>${PHONE}</strong> or reply to this email.</p>
    <p>Best regards,<br><strong>${BRAND_NAME}</strong></p>
  `;
  return emailLayout(body, {
    extraCss: specTableCss,
    footerNote: 'If you did not request this summary, please disregard this email.',
  });
}

export function generatePreviewHtml(templateId: string): string | null {
  switch (templateId) {
    case 'enquiry-received-customer': return generateEnquiryReceivedCustomer();
    case 'enquiry-received-admin': return generateEnquiryReceivedAdmin();
    case 'spec-summary-single': return generateSpecSummarySingle();
    case 'spec-summary-comparison': return generateSpecSummaryComparison();
    case 'quote-confirmation': return generateQuoteConfirmation();
    case 'finance-submission': return generateFinanceSubmission();
    case 'option-chosen-admin': return generateOptionChosenAdmin();
    case 'lead-received-customer': return generateLeadReceivedCustomer();
    case 'lead-received-admin': return generateLeadReceivedAdmin();
    case 'welcome-email': return generateWelcomeEmail();
    case 'set-password': return generateSetPassword();
    case 'password-reset': return generatePasswordReset();
    case 'depot-invoice': return generateDepotInvoice();
    case 'testimonial-request': return generateTestimonialRequest();
    case 'quote-spec-summary-single': return generateQuoteSpecSummarySingle();
    case 'quote-spec-summary-comparison': return generateQuoteSpecSummaryComparison();
    default: return null;
  }
}
