import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Server } from "http";

// ── vi.hoisted lets us reference the spy inside vi.mock factories ───────────
const mockSendOptionChosenAdminNotification = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);

// ── Module mocks (hoisted before any imports) ────────────────────────────────

vi.mock("../auth.js", () => ({
  setupAuth: vi.fn().mockResolvedValue(undefined),
  isAuthenticated: (_: any, __: any, next: any) => next(),
  isAdmin: (_: any, __: any, next: any) => next(),
  isBasicAdmin: (_: any, __: any, next: any) => next(),
  isFullAdmin: (_: any, __: any, next: any) => next(),
  isFinanceUser: (_: any, __: any, next: any) => next(),
  getSession: () => (_: any, __: any, next: any) => next(),
  createUser: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
}));

vi.mock("../storage.js", () => ({
  storage: new Proxy(
    {},
    {
      get(_target: any, prop: string) {
        if (prop === "then") return undefined;
        return vi.fn().mockResolvedValue(undefined);
      },
    }
  ),
}));

vi.mock("../seo.js", () => ({
  buildVanMeta: vi.fn().mockReturnValue({}),
  SITE_URL: "https://example.com",
  SITE_NAME: "Test",
}));

vi.mock("../blogGenerator.js", () => ({
  generateAiBlogPost: vi.fn(),
}));

vi.mock("../email.js", () => ({
  sendOptionChosenAdminNotification: mockSendOptionChosenAdminNotification,
  emailLayout: (body: string) => `<html><body>${body}</body></html>`,
  checkEmailConfig: vi.fn(),
  getUncachableResendClient: vi
    .fn()
    .mockResolvedValue({ client: {}, fromEmail: "noreply@test.com" }),
  sendQuoteSpecSummaryEmail: vi.fn().mockResolvedValue(undefined),
  sendQuoteConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendFinanceSubmissionEmail: vi.fn().mockResolvedValue(undefined),
  sendDepotInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendTestimonialRequestEmail: vi.fn().mockResolvedValue(undefined),
  sendQuoteReceivedEmails: vi.fn().mockResolvedValue(undefined),
  sendLeadReceivedEmails: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendSetPasswordEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

let app: express.Express;
let httpServer: Server;

beforeAll(async () => {
  const { registerRoutes } = await import("../routes.js");
  app = express();
  app.use(express.json());
  httpServer = await registerRoutes(app);
});

afterAll(() => {
  httpServer?.close();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/email-preview/send-test — option-chosen-admin", () => {
  beforeEach(() => {
    mockSendOptionChosenAdminNotification.mockClear();
  });

  it("returns 200 { ok: true }", async () => {
    const res = await request(app)
      .post("/api/admin/email-preview/send-test")
      .send({ to: "tester@example.com", templateId: "option-chosen-admin" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("calls sendOptionChosenAdminNotification exactly once with toOverride and fixture fields", async () => {
    await request(app)
      .post("/api/admin/email-preview/send-test")
      .send({ to: "tester@example.com", templateId: "option-chosen-admin" });

    expect(mockSendOptionChosenAdminNotification).toHaveBeenCalledOnce();
    expect(mockSendOptionChosenAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        toOverride: "tester@example.com",
        quoteId: expect.any(String),
        customerName: expect.any(String),
        customerEmail: expect.any(String),
        customerPhone: expect.any(String),
        chosenOption: expect.stringMatching(/^[AB]$/),
        optionDetails: expect.objectContaining({
          estTotal: expect.any(Number),
        }),
      })
    );
  });

  it("returns 400 and does not call the send function when the email address is invalid", async () => {
    const res = await request(app)
      .post("/api/admin/email-preview/send-test")
      .send({ to: "not-an-email", templateId: "option-chosen-admin" });

    expect(res.status).toBe(400);
    expect(mockSendOptionChosenAdminNotification).not.toHaveBeenCalled();
  });
});
