import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Lock, Circle, CheckCircle2, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { resolveVanReg } from "@/lib/vanDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DueByCountdown } from "@/components/DueByCountdown";

const COMMITTED_STATUSES = new Set(["deposit_taken", "finance_approved", "in_build", "in_workshop"]);

// Display priority — in_workshop floats to the top of the kiosk grid
const STATUS_PRIORITY: Record<string, number> = {
  in_workshop: 0,
  in_build: 1,
  deposit_taken: 2,
  finance_approved: 3,
};

const STATUS_LABEL: Record<string, string> = {
  deposit_taken: "Deposit Taken",
  finance_approved: "Finance Approved",
  in_build: "In Build",
  in_workshop: "In Workshop",
  completed: "Completed",
};

const STATUS_COLOUR: Record<string, string> = {
  deposit_taken: "bg-lime-600",
  finance_approved: "bg-sky-600",
  in_build: "bg-orange-500",
  in_workshop: "bg-red-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDbDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(val: Date | string | null | undefined): string {
  const d = parseDbDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function daysUntil(val: Date | string | null | undefined): number | null {
  const d = parseDbDate(val);
  if (!d) return null;
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const tgt = new Date(d);
  tgt.setUTCHours(0, 0, 0, 0);
  return Math.round((tgt.getTime() - now.getTime()) / 86_400_000);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface KioskQuote {
  id: string;
  status: string;
  statusChangedAt: string | null;
  targetCompletionDate: string | null;
  userName: string | null;
  company: string | null;
  vanId: string | null;
  customVanDescription: string | null;
  vanRegistration: string | null;
  kitId: string | null;
  selectedUpgradeIds: string[];
  // Quantity map keyed by upgrade id — used to prefix stage labels with "N× "
  // when the customer has ordered more than one of an item.
  selectedUpgrades?: Record<string, number>;
  confirmationToken: string | null;
  completedBuildStages: Array<string | { id: string; initials: string }>;
  customBuildStages: Array<{ id: string; label: string }> | null;
  artworkApprovedAt: string | null;
}

interface KioskUpgrade { id: string; name: string; category: string; variantName?: string | null; }

// When two upgrades share the same parent name (e.g. all four CCTV variants are
// stored as "Van Online CCTV/NVR System"), the variant_name is the only thing
// that distinguishes them on the workshop floor. Prefer the variant name
// whenever it's set so the kiosk doesn't show "CCTV" twice.
const displayLabel = (u: { name: string; variantName?: string | null }) =>
  (u.variantName && u.variantName.trim()) ? u.variantName.trim() : u.name;

// Prefix the stage label with "N× " when the customer has ordered more than
// one of an item — mirrors the build sheet & workshop QR page so the kiosk
// reads as "2× Compressor" instead of just "Compressor" for double-orders.
const qtyLabel = (u: { id: string; name: string; variantName?: string | null }, qtyMap: Record<string, number>) => {
  const base = displayLabel(u);
  const q = qtyMap[u.id] ?? 1;
  return q > 1 ? `${q}× ${base}` : base;
};

interface KioskData {
  quotes: KioskQuote[];
  vans: { id: string; make: string; model: string; year: number | null; reg: string | null }[];
  kits: { id: string; name: string; headlineMachines?: string[] | null }[];
  upgrades: KioskUpgrade[];
}

// ── Stage generation ──────────────────────────────────────────────────────────

// Stage generation — mirrors server/routes.ts /api/build-progress-public/:token
// so the kiosk shows the IDENTICAL stage list the lads see when they scan the QR
const isWrap = (u: { category?: string | null; name?: string | null }) => {
  const c = (u.category ?? "").toLowerCase();
  const n = (u.name ?? "").toLowerCase();
  // Full Wrap / Half Wrap live in the "branding" category, so also sniff
  // the name for "wrap"/"graphic" — otherwise the artwork stages never get
  // generated for those upgrades and the kiosk skips Artwork Approved.
  return c.includes("wrap") || c.includes("graphic") ||
    n.includes("wrap") || n.includes("graphic");
};
const isWall = (u: { category?: string | null }) =>
  (u.category ?? "").toLowerCase().includes("interior wall");
const isBusinessPack = (u: { name?: string | null }) =>
  /business\s*pack|business\s*package/i.test(u.name ?? "");
// 48V silent-compressor systems are split into two sub-stages so the
// auto-electrician can sign off the wiring independently of the fitter
// who bolts the compressor in.
const is48vSystem = (u: { name?: string | null }) =>
  /48\s*v|silent\s+compressor/i.test(u.name ?? "");

function generateStages(kitName: string | null, selectedUpgrades: KioskUpgrade[], qtyMap: Record<string, number> = {}) {
  const label = (u: KioskUpgrade) => qtyLabel(u, qtyMap);
  const stages: { id: string; label: string }[] = [];
  stages.push({ id: "prep", label: "Van Preparation" });
  if (kitName) stages.push({ id: "kit", label: `Install ${kitName}` });

  // Priority upgrades sit directly after the install pack so every kiosk card
  // groups the headline kit add-ons (48V Silent Compressor, Super Spin, T4000 Pro)
  // in the same place regardless of selection order.
  const priorityRank = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes("48v")) return 0;
    if (n.includes("super spin")) return 1;
    if (n.includes("t4000") || n.includes("t-4000")) return 2;
    return 99;
  };
  const orderByPriority = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => priorityRank(a.name) - priorityRank(b.name));

  const nonWrap = orderByPriority(selectedUpgrades.filter((u) => !isWrap(u) && !isWall(u)));
  const wrapOnly = selectedUpgrades.filter((u) => isWrap(u) && !isWall(u));
  const wallOnly = selectedUpgrades.filter((u) => isWall(u) && !isWrap(u));

  for (const u of nonWrap) {
    if (is48vSystem(u)) {
      // Split: electrics first, then compressor fit. Two separate ticks
      // so different lads can sign off each half independently.
      const base = label(u);
      stages.push({ id: `upg_${u.id}_electrics`, label: `${base} — Electrics` });
      stages.push({ id: `upg_${u.id}_fit`, label: `${base} — Compressor Fit` });
    } else {
      stages.push({ id: `upg_${u.id}`, label: label(u) });
      if (isBusinessPack(u)) {
        stages.push({ id: `upg_${u.id}_website`, label: "Website Done" });
        stages.push({ id: `upg_${u.id}_print`, label: "Leaflets & Business Cards Ordered" });
      }
    }
  }
  if (wrapOnly.length > 0) {
    stages.push({ id: "artwork_sent", label: "Artwork Sent" });
    stages.push({ id: "artwork_approved", label: "Artwork Approved" });
    stages.push({ id: "wrap_printed", label: "Wrap Printed" });
  }
  for (const u of wrapOnly) stages.push({ id: `upg_${u.id}`, label: label(u) });
  if (wallOnly.length > 0) {
    stages.push({ id: "interior_walls_artwork_sent", label: "Interior Walls Artwork Sent" });
    stages.push({ id: "interior_wall_artwork_approved", label: "Interior Wall Artwork Approved" });
    stages.push({ id: "interior_walls_ordered", label: "Interior Walls Ordered" });
  }
  for (const u of wallOnly) stages.push({ id: `upg_${u.id}`, label: label(u) });
  stages.push({ id: "final_checks", label: "Final Checks" });
  stages.push({ id: "valet", label: "Valet & Handover" });
  return stages;
}

function normaliseCompleted(raw: Array<string | { id: string; initials: string }>) {
  return raw.map((e) =>
    typeof e === "string" ? { id: e, initials: null } : { id: e.id, initials: e.initials ?? null }
  );
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })),
      10000
    );
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

// ── Job card — full spec visible ───────────────────────────────────────────────

function JobCard({
  q, van, kit, selectedUpgrades,
}: {
  q: KioskQuote;
  van: { make: string; model: string; year: number | null; reg: string | null } | undefined;
  kit: { name: string; headlineMachines?: string[] | null } | undefined;
  selectedUpgrades: KioskUpgrade[];
}) {
  const stages = q.customBuildStages ?? generateStages(kit?.name ?? null, selectedUpgrades, q.selectedUpgrades ?? {});
  const completed = normaliseCompleted(q.completedBuildStages);
  const completedIds = new Set(completed.map((c) => c.id));

  // Triple-tap to tick (hold gestures collide with the kiosk touchscreen OS)
  const queryClient = useQueryClient();
  const { token } = useParams<{ token: string }>();
  const tapState = useRef<{ id: string | null; count: number; timer: any }>({ id: null, count: 0, timer: null });
  const [tickDialog, setTickDialog] = useState<{ stageId: string; label: string } | null>(null);
  const [undoDialog, setUndoDialog] = useState<{ stageId: string; label: string; initials: string } | null>(null);
  const [undoPin, setUndoPin] = useState("");
  const [statusDialog, setStatusDialog] = useState<{ next: "in_workshop" | "in_build" } | null>(null);
  const [dateDialog, setDateDialog] = useState<{ value: string; time?: string } | null>(null);

  const tickMutation = useMutation({
    mutationFn: async ({ stageId, initials }: { stageId: string; initials: string }) => {
      if (!q.confirmationToken) throw new Error("No confirmation token on quote");
      const res = await apiRequest("PATCH", `/api/build-progress-public/${q.confirmationToken}/stage`, {
        stageId, completed: true, initials,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/pipeline", token] });
      setTickDialog(null);
    },
    onError: (err: any) => alert(`Could not save: ${err?.message ?? "unknown error"}`),
  });

  const untickMutation = useMutation({
    mutationFn: async ({ stageId, initials, pin }: { stageId: string; initials: string; pin: string }) => {
      if (!q.confirmationToken) throw new Error("No confirmation token on quote");
      const res = await apiRequest("PATCH", `/api/build-progress-public/${q.confirmationToken}/stage`, {
        stageId, completed: false, initials, pin,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/pipeline", token] });
      setUndoDialog(null);
      setUndoPin("");
    },
    onError: (err: any) => alert(`Could not undo: ${err?.message ?? "unknown error"}`),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ next }: { next: "in_workshop" | "in_build" | "completed" }) => {
      const res = await apiRequest("POST", `/api/kiosk/pipeline/${token}/status`, {
        quoteId: q.id, status: next,
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate every cache that derives from quote status so a kiosk
      // status change ripples through the admin pipeline, quote list,
      // calendar, dashboard counts, etc.
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/pipeline", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pipeline-board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      setStatusDialog(null);
    },
    onError: (err: any) => alert(`Could not update status: ${err?.message ?? "unknown error"}`),
  });

  const targetDateMutation = useMutation({
    mutationFn: async (isoDateOrNull: string | null) => {
      const res = await apiRequest("POST", `/api/kiosk/pipeline/${token}/target-date`, {
        quoteId: q.id, targetCompletionDate: isoDateOrNull,
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate every cache that derives from targetCompletionDate so the
      // change ripples through Build Sheet, QR workshop view, Pipeline Board,
      // Calendar, etc. without anyone needing to refresh.
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/pipeline", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pipeline-board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar"] });
      setDateDialog(null);
    },
    onError: (err: any) => alert(`Could not save due-by date: ${err?.message ?? "unknown error"}`),
  });

  // Generic triple-tap (within 600ms) — keyed so adjacent rows/badges don't share counts
  const handleTripleTap = (key: string, onTriple: () => void) => {
    const s = tapState.current;
    if (s.timer) clearTimeout(s.timer);
    if (s.id !== key) { s.id = key; s.count = 0; }
    s.count += 1;
    if (s.count >= 3) {
      s.id = null; s.count = 0;
      onTriple();
      return;
    }
    s.timer = setTimeout(() => { s.id = null; s.count = 0; }, 600);
  };

  const handleStageTap = (stageId: string, label: string, alreadyDone: boolean) => {
    if (alreadyDone) {
      // Triple-tap a done stage to open the undo (PIN) dialog. Only the
      // person who originally ticked it can untick it, and they need their
      // 4-digit kiosk PIN.
      const entry = completed.find((c) => c.id === stageId);
      const initials = entry?.initials ?? null;
      if (!initials) return; // legacy untracked tick — can't safely undo
      handleTripleTap(`stage:${stageId}`, () => { setUndoPin(""); setUndoDialog({ stageId, label, initials }); });
      return;
    }
    handleTripleTap(`stage:${stageId}`, () => setTickDialog({ stageId, label }));
  };

  const handleStatusTap = () => {
    if (q.status === "in_build") {
      handleTripleTap(`status:${q.id}`, () => setStatusDialog({ next: "in_workshop" }));
    } else if (q.status === "in_workshop") {
      handleTripleTap(`status:${q.id}`, () => setStatusDialog({ next: "in_build" }));
    }
  };

  const handleDueByTap = () => {
    handleTripleTap(`due:${q.id}`, () => {
      // Use the existing target's local date + time so editing keeps the
      // collection time intact. Falls back to 5pm for new entries.
      if (q.targetCompletionDate) {
        const d = new Date(q.targetCompletionDate);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        setDateDialog({ value: `${y}-${mo}-${da}`, time: `${hh}:${mm}` });
      } else {
        setDateDialog({ value: "", time: "17:00" });
      }
    });
  };

  const doneCount = stages.filter((s) => completedIds.has(s.id)).length;
  const total = stages.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = doneCount === total && total > 0;

  const vanLabel = van
    ? `${van.year ?? ""} ${van.make} ${van.model}`.trim()
    : q.customVanDescription || null;

  // Reg plate: customer's entered reg wins (own-van / finance), otherwise fall
  // back to the stock van's plate so a chosen stock van still shows its reg.
  const regPlate = resolveVanReg(van, q.vanRegistration);

  const days = daysUntil(q.targetCompletionDate);
  const dueColour =
    days === null ? "text-zinc-600"
    : days < 0 ? "text-red-400"
    : days === 0 ? "text-orange-400"
    : days <= 3 ? "text-yellow-400"
    : "text-zinc-500";

  const workshopUrl = q.confirmationToken
    ? `${window.location.origin}/workshop/${q.confirmationToken}`
    : null;

  // Group upgrades by category
  const upgradesByCategory: Record<string, KioskUpgrade[]> = {};
  for (const u of selectedUpgrades) {
    const cat = u.category || "Other";
    if (!upgradesByCategory[cat]) upgradesByCategory[cat] = [];
    upgradesByCategory[cat].push(u);
  }
  const upgradeCategories = Object.entries(upgradesByCategory);

  return (
    <div
      className={`rounded-lg border flex flex-col gap-3 p-3 bg-zinc-950 border-zinc-800 ${
        allDone ? "opacity-60" : ""
      }`}
      data-testid={`kiosk-card-${q.id}`}
    >
      {/* Header — same as workshop screen */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-400">Workshop Build Sheet</p>
          <h2 className="text-base font-bold text-white leading-tight truncate">{q.userName || "—"}</h2>
          {q.company && (
            <p className="text-yellow-400/80 text-base font-bold leading-tight truncate">{q.company}</p>
          )}
          {regPlate && (
            <div className="pt-1">
              <span className="inline-block bg-yellow-400 text-black font-bold font-mono tracking-widest text-lg px-2 py-0.5 rounded border-2 border-black/20 uppercase">
                {regPlate}
              </span>
            </div>
          )}
          {vanLabel && <p className="text-[11px] text-zinc-500 truncate">{vanLabel}</p>}
        </div>

        {/* % done on the right + QR */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-400 leading-none tabular-nums">{pct}%</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{doneCount}/{total} done</p>
          </div>
          {workshopUrl && (
            <div className="bg-white rounded p-1">
              <QRCodeSVG value={workshopUrl} size={56} level="M" />
            </div>
          )}
        </div>
      </div>

      {/* Status + due-date strip — triple-tap the badge to toggle In Build <-> In Workshop */}
      <div className="flex items-center justify-between gap-2 -mt-1">
        <button
          type="button"
          onClick={handleStatusTap}
          disabled={q.status !== "in_build" && q.status !== "in_workshop"}
          className={`text-[11px] font-bold px-2 py-1 rounded text-white select-none ${STATUS_COLOUR[q.status] ?? "bg-zinc-600"} ${
            q.status === "in_build" || q.status === "in_workshop" ? "active:opacity-70 cursor-pointer" : ""
          }`}
          data-testid={`button-kiosk-status-${q.id}`}
        >
          {STATUS_LABEL[q.status] ?? q.status}
        </button>
        <p className={`text-[10px] ${dueColour}`}>
          {q.targetCompletionDate ? (
            <>
              <span className="font-semibold">Due {fmtDate(q.targetCompletionDate)}</span>
              {days !== null && (
                <span className="ml-1 opacity-70">
                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-700">No due date</span>
          )}
        </p>
      </div>

      {/* Big Due-By countdown — WKS:DAYS:HRS:MIN, plus 6wk / 9wk chips.
          Triple-tap opens a calendar picker; the change propagates back to
          the admin quote, build sheet, QR workshop view, calendar, etc. */}
      <div
        onClick={handleDueByTap}
        className="cursor-pointer select-none active:opacity-70"
        title="Triple-tap to change due-by date"
        data-testid={`due-by-tap-${q.id}`}
      >
        <DueByCountdown
          targetCompletionDate={q.targetCompletionDate}
          artworkApprovedAt={q.artworkApprovedAt}
          variant="dark"
        />
      </div>

      {/* Yellow progress bar — same as workshop screen */}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all duration-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Build stages — same pill-style rows as workshop screen.
          NB: the "Install Pack …" stage row already shows the pack name and
          headline machines, so we don't render a separate Equipment Pack
          block above to avoid duplication. */}
      {stages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Build Stages</p>
          <div className="space-y-2">
            {stages.map((s) => {
              const done = completedIds.has(s.id);
              const entry = completed.find((c) => c.id === s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => handleStageTap(s.id, s.label, done)}
                  data-testid={`stage-row-${s.id}`}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg select-none cursor-pointer",
                    done
                      ? "bg-zinc-900/50 border border-zinc-800/50 opacity-70 active:bg-zinc-900"
                      : "bg-zinc-900 border border-zinc-800 active:bg-zinc-800",
                  ].join(" ")}
                  title={done ? "Triple-tap to undo (PIN required)" : "Triple-tap to tick off"}
                >
                  {done ? (
                    <Lock className="w-5 h-5 shrink-0 text-zinc-600" />
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 text-zinc-600" />
                  )}
                  <span
                    className={[
                      "flex-1 min-w-0 font-medium text-sm leading-tight",
                      done ? "line-through text-zinc-600" : "text-white",
                    ].join(" ")}
                  >
                    {s.label}
                    {/* Headline machines repeated under the Install-Pack stage
                        row so the workshop sees the actual tyre machine /
                        balancer / compressor models inline with the build
                        stage they relate to, not just up in the Equipment
                        Pack header. */}
                    {s.id === "kit" && kit?.headlineMachines && kit.headlineMachines.length > 0 && (
                      <span
                        className={[
                          "block mt-0.5 text-[11px] font-normal leading-tight line-clamp-2",
                          done ? "text-zinc-700 no-underline" : "text-zinc-400",
                        ].join(" ")}
                        data-testid={`stage-kit-machines-${q.id}`}
                      >
                        {kit.headlineMachines.join(" · ")}
                      </span>
                    )}
                    {/* Workshop hint — the pack's stock machines above are the
                        baseline only. Any upgrade the customer added (T4000,
                        Super Spin, 48V/270L compressor, etc.) is listed in the
                        Upgrades section further down this card and supersedes
                        the corresponding stock item. */}
                    {s.id === "kit" && selectedUpgrades.length > 0 && (
                      <span
                        className={[
                          "block mt-0.5 text-[11px] italic font-normal leading-tight",
                          done ? "text-zinc-700 no-underline" : "text-yellow-400/70",
                        ].join(" ")}
                        data-testid={`stage-kit-upgrades-note-${q.id}`}
                      >
                        Check upgrades below — they may replace items in this pack.
                      </span>
                    )}
                  </span>
                  {done && entry?.initials && (
                    <span className="shrink-0 text-[10px] font-bold text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded uppercase tracking-wide">
                      {entry.initials}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All-done banner — same as workshop screen, plus a giant "Mark Job
          as Completed" button. Triple-tap (same gesture pattern as the
          rest of the kiosk) so the lads don't fat-finger it. */}
      {allDone && q.status !== "completed" && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-3 text-center space-y-3">
          <p className="font-bold text-white text-sm">All stages complete</p>
          <button
            type="button"
            onClick={() => handleTripleTap(`complete:${q.id}`, () => setStatusDialog({ next: "completed" }))}
            className="w-full rounded-md bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-base px-4 py-3 select-none cursor-pointer inline-flex items-center justify-center gap-2"
            data-testid={`button-mark-completed-${q.id}`}
            title="Triple-tap to mark this job as completed"
          >
            <Check className="w-5 h-5" />
            Mark Job as Completed
          </button>
        </div>
      )}
      {q.status === "completed" && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-center">
          <p className="font-bold text-green-300 text-sm">JOB COMPLETED</p>
        </div>
      )}

      {/* Triple-tap stage-tick dialog — preset name buttons (no keyboard on the kiosk) */}
      <Dialog open={tickDialog !== null} onOpenChange={(open) => { if (!open) setTickDialog(null); }}>
        <DialogContent data-testid="dialog-stage-tick">
          <DialogHeader>
            <DialogTitle>Tick "{tickDialog?.label}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Who's ticking this off?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "GB" })}
                data-testid="button-stage-gaz"
              >
                Gaz<span className="ml-2 opacity-70 text-base">(GB)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "KJ" })}
                data-testid="button-stage-kev"
              >
                Kev<span className="ml-2 opacity-70 text-base">(KJ)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "HM" })}
                data-testid="button-stage-hm"
              >
                Haz<span className="ml-2 opacity-70 text-base">(HM)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "RM" })}
                data-testid="button-stage-rm"
              >
                Zino<span className="ml-2 opacity-70 text-base">(RM)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "NK" })}
                data-testid="button-stage-nk"
              >
                Nick<span className="ml-2 opacity-70 text-base">(NK)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "RC" })}
                data-testid="button-stage-rc"
              >
                Ryan<span className="ml-2 opacity-70 text-base">(RC)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "KW" })}
                data-testid="button-stage-kw"
              >
                Kenny<span className="ml-2 opacity-70 text-base">(KW)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "PF" })}
                data-testid="button-stage-pf"
              >
                Paul<span className="ml-2 opacity-70 text-base">(PF)</span>
              </Button>
              <Button
                size="lg"
                className="h-20 text-xl font-bold"
                disabled={tickMutation.isPending}
                onClick={() => tickDialog && tickMutation.mutate({ stageId: tickDialog.stageId, initials: "EC" })}
                data-testid="button-stage-ec"
              >
                Eddie<span className="ml-2 opacity-70 text-base">(EC)</span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTickDialog(null)} data-testid="button-stage-cancel">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Triple-tap undo dialog — only the lad who ticked the stage can undo
          it, and only with their 4-digit kiosk PIN. Stops a mistap on
          someone's name from rolling back work that's already signed off. */}
      <Dialog
        open={undoDialog !== null}
        onOpenChange={(open) => { if (!open) { setUndoDialog(null); setUndoPin(""); } }}
      >
        <DialogContent data-testid="dialog-stage-undo">
          <DialogHeader>
            <DialogTitle>Undo "{undoDialog?.label}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Ticked off by <span className="font-bold text-foreground">{undoDialog?.initials}</span>.
              Enter their 4-digit PIN to undo.
            </p>
            <div className="flex justify-center">
              <div
                className="font-mono text-4xl tracking-[0.5em] tabular-nums border rounded-md px-4 py-3 min-w-[10rem] text-center bg-zinc-900 text-white"
                data-testid="text-undo-pin-display"
              >
                {"●".repeat(undoPin.length) + "○".repeat(Math.max(0, 4 - undoPin.length))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map((n) => (
                <Button
                  key={n}
                  size="lg"
                  variant="outline"
                  className="h-16 text-2xl font-bold"
                  disabled={untickMutation.isPending || undoPin.length >= 4}
                  onClick={() => setUndoPin((p) => (p.length < 4 ? p + n : p))}
                  data-testid={`button-pin-${n}`}
                >
                  {n}
                </Button>
              ))}
              <Button
                size="lg"
                variant="ghost"
                className="h-16 text-base"
                disabled={untickMutation.isPending || undoPin.length === 0}
                onClick={() => setUndoPin("")}
                data-testid="button-pin-clear"
              >
                Clear
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 text-2xl font-bold"
                disabled={untickMutation.isPending || undoPin.length >= 4}
                onClick={() => setUndoPin((p) => (p.length < 4 ? p + "0" : p))}
                data-testid="button-pin-0"
              >
                0
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-16 text-base"
                disabled={untickMutation.isPending || undoPin.length === 0}
                onClick={() => setUndoPin((p) => p.slice(0, -1))}
                data-testid="button-pin-back"
              >
                ←
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => { setUndoDialog(null); setUndoPin(""); }}
              data-testid="button-undo-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={untickMutation.isPending || undoPin.length !== 4 || !undoDialog}
              onClick={() => undoDialog && untickMutation.mutate({ stageId: undoDialog.stageId, initials: undoDialog.initials, pin: undoPin })}
              data-testid="button-undo-confirm"
            >
              {untickMutation.isPending ? "Undoing…" : "Undo Tick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Triple-tap due-by dialog — calendar picker, propagates everywhere.
          Body scrolls and footer stays pinned so Save/Cancel are always
          reachable, even on small kiosk tablets where the calendar would
          otherwise push them off the bottom of the screen. */}
      <Dialog open={dateDialog !== null} onOpenChange={(open) => { if (!open) setDateDialog(null); }}>
        <DialogContent
          data-testid="dialog-kiosk-due-by"
          className="max-h-[90vh] p-0 flex flex-col gap-0 sm:max-w-md"
        >
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle>Edit Due-By Date</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2 space-y-3 overflow-y-auto flex-1 min-h-0">
            <p className="text-xs text-muted-foreground">
              {q.userName ? `${q.userName}'s` : "This"} build —
              tap a date below. This updates everywhere: build sheet,
              workshop QR page, pipeline board and calendar.
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={dateDialog?.value ? new Date(`${dateDialog.value}T00:00:00`) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  setDateDialog({ value: `${y}-${m}-${day}`, time: dateDialog?.time ?? "17:00" });
                }}
                initialFocus
                data-testid="calendar-kiosk-due-by"
              />
            </div>
            {dateDialog?.value && (
              <div className="space-y-2">
                <p className="text-center text-sm font-medium" data-testid="text-kiosk-due-by-selected">
                  {new Date(`${dateDialog.value}T00:00:00`).toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Time
                  </label>
                  <input
                    type="time"
                    value={dateDialog.time ?? "17:00"}
                    onChange={(e) => setDateDialog({ value: dateDialog.value, time: e.target.value || "17:00" })}
                    className="text-base rounded border px-3 py-2 bg-background border-input min-w-[7rem]"
                    data-testid="input-kiosk-due-by-time"
                  />
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  Defaults to 5pm. Change it if you know the exact pickup time.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-wrap px-4 py-3 border-t shrink-0 bg-background">
            <Button variant="ghost" onClick={() => setDateDialog(null)} data-testid="button-due-by-cancel">
              Cancel
            </Button>
            {q.targetCompletionDate && (
              <Button
                variant="outline"
                disabled={targetDateMutation.isPending}
                onClick={() => targetDateMutation.mutate(null)}
                data-testid="button-due-by-clear"
              >
                Clear
              </Button>
            )}
            <Button
              disabled={targetDateMutation.isPending || !dateDialog?.value}
              onClick={() => {
                if (!dateDialog?.value) return;
                const [hh, mm] = (dateDialog.time ?? "17:00").split(":").map((n) => parseInt(n, 10));
                const [y, m, d] = dateDialog.value.split("-").map((n) => parseInt(n, 10));
                const local = new Date(y, m - 1, d, isFinite(hh) ? hh : 17, isFinite(mm) ? mm : 0, 0, 0);
                targetDateMutation.mutate(local.toISOString());
              }}
              data-testid="button-due-by-save"
            >
              {targetDateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Triple-tap status dialog — confirm In Build <-> In Workshop */}
      <Dialog open={statusDialog !== null} onOpenChange={(open) => { if (!open) setStatusDialog(null); }}>
        <DialogContent data-testid="dialog-kiosk-status">
          <DialogHeader>
            <DialogTitle>
              Move to {statusDialog ? STATUS_LABEL[statusDialog.next] : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {q.userName ? `${q.userName}'s` : "This"} build will be moved from
            {" "}<span className="font-semibold">{STATUS_LABEL[q.status] ?? q.status}</span> to
            {" "}<span className="font-semibold">{statusDialog ? STATUS_LABEL[statusDialog.next] : ""}</span>.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusDialog(null)} data-testid="button-status-cancel">
              Cancel
            </Button>
            <Button
              disabled={statusMutation.isPending}
              onClick={() => statusDialog && statusMutation.mutate({ next: statusDialog.next })}
              data-testid="button-status-confirm"
            >
              {statusMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Touch-drag scroll hook ────────────────────────────────────────────────────

function useTouchScroll(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startY = 0;
    let startScrollTop = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let rafId: number;

    const onTouchStart = (e: TouchEvent) => {
      cancelAnimationFrame(rafId);
      startY = e.touches[0].clientY;
      startScrollTop = el.scrollTop;
      lastY = startY;
      lastTime = Date.now();
      velocity = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 0) velocity = (lastY - y) / dt;
      lastY = y;
      lastTime = now;
      el.scrollTop = startScrollTop + (startY - y);
      e.preventDefault();
    };

    const onTouchEnd = () => {
      // Momentum: keep scrolling at velocity, decaying
      const momentum = () => {
        if (Math.abs(velocity) < 0.05) return;
        el.scrollTop += velocity * 16;
        velocity *= 0.93;
        rafId = requestAnimationFrame(momentum);
      };
      rafId = requestAnimationFrame(momentum);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      cancelAnimationFrame(rafId);
    };
  }, [ref]);
}

// ── Main board ────────────────────────────────────────────────────────────────

export default function KioskPipelineBoard() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const scrollRef = useRef<HTMLDivElement>(null);
  useTouchScroll(scrollRef as React.RefObject<HTMLElement>);

  const { data, isLoading, isError } = useQuery<KioskData>({
    queryKey: ["/api/kiosk/pipeline", token],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/pipeline/${token}`);
      if (!res.ok) throw new Error("Invalid token");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    retry: false,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="text-5xl font-black text-red-400">Access Denied</div>
        <p className="text-zinc-400 text-lg">This kiosk link is invalid or has been reset.</p>
        <p className="text-zinc-500 text-sm">Ask an admin to generate a new kiosk URL.</p>
      </div>
    );
  }

  const committedQuotes = data.quotes
    .filter((q) => COMMITTED_STATUSES.has(q.status))
    .sort((a, b) => {
      // Primary: soonest due-by first so imminent vans float to the top.
      // Anything without a date sinks to the bottom.
      const at = a.targetCompletionDate ? new Date(a.targetCompletionDate).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.targetCompletionDate ? new Date(b.targetCompletionDate).getTime() : Number.POSITIVE_INFINITY;
      if (at !== bt) return at - bt;
      // Tie-break: keep In Workshop above In Build (existing status priority).
      return (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
    });
  const n = committedQuotes.length;

  const cols = n <= 2 ? 2 : n <= 6 ? 3 : 4;

  return (
    <div
      className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none"
      style={{ cursor: "none" }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
          <h1 className="text-lg font-black tracking-tight text-white">Workshop Pipeline</h1>
          <span className="text-zinc-600 text-xs">{n} active job{n !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-500 text-xs">
          <span>refreshes every 30s</span>
          <span className="text-white font-bold text-base tabular-nums"><LiveClock /></span>
        </div>
      </div>

      {/* Scrollable grid */}
      {n === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
          <p className="text-5xl font-black mb-3">—</p>
          <p className="text-xl font-semibold">No active jobs right now</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
          }}
        >
          <div
            className="p-2 gap-2"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {committedQuotes.map((q) => {
              const van = data.vans.find((v) => v.id === q.vanId);
              const kit = data.kits.find((k) => k.id === q.kitId);
              const selectedUpgrades = data.upgrades.filter((u) =>
                (q.selectedUpgradeIds ?? []).includes(u.id)
              );
              return (
                <JobCard
                  key={q.id}
                  q={q}
                  van={van}
                  kit={kit}
                  selectedUpgrades={selectedUpgrades}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
