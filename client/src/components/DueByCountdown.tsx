import { useEffect, useState, useMemo } from "react";
import { addWeeks, countdown, isAutoSeeded, DUE_BY_LEAD_WEEKS_MIN, DUE_BY_LEAD_WEEKS_MAX } from "@shared/dueByCountdown";

interface DueByCountdownProps {
  targetCompletionDate: string | Date | null | undefined;
  artworkApprovedAt: string | Date | null | undefined;
  editable?: boolean;
  onChange?: (isoDateOrNull: string | null) => void;
  variant?: "light" | "dark";
}

function pad(n: number, width = 2) {
  return String(Math.max(0, n)).padStart(width, "0");
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function DueByCountdown({
  targetCompletionDate,
  artworkApprovedAt,
  editable = false,
  onChange,
  variant = "light",
}: DueByCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = useMemo(() => {
    if (!targetCompletionDate) return null;
    const d = targetCompletionDate instanceof Date ? targetCompletionDate : new Date(targetCompletionDate);
    return isNaN(d.getTime()) ? null : d;
  }, [targetCompletionDate]);

  const approved = useMemo(() => {
    if (!artworkApprovedAt) return null;
    const d = artworkApprovedAt instanceof Date ? artworkApprovedAt : new Date(artworkApprovedAt);
    return isNaN(d.getTime()) ? null : d;
  }, [artworkApprovedAt]);

  const c = countdown(target, now);
  const seeded = isAutoSeeded(approved, target);
  const sixWeekDate = approved ? addWeeks(approved, DUE_BY_LEAD_WEEKS_MIN) : null;
  const nineWeekDate = approved ? addWeeks(approved, DUE_BY_LEAD_WEEKS_MAX) : null;
  const showSixWeekChip = !!(sixWeekDate && now < sixWeekDate.getTime());

  // Convert target to YYYY-MM-DD and HH:MM (local time) for the editor.
  // Default collection time is 17:00 (5pm) when no target is set yet.
  const dateInputValue = target
    ? `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`
    : "";
  const timeInputValue = target
    ? `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`
    : "17:00";

  const emitChange = (dateStr: string, timeStr: string) => {
    if (!onChange) return;
    if (!dateStr) { onChange(null); return; }
    const [hh, mm] = (timeStr || "17:00").split(":").map((n) => parseInt(n, 10));
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    // Build a local-time Date then serialise to UTC ISO so the saved
    // timestamp represents the chosen wall-clock collection moment.
    const local = new Date(y, (m || 1) - 1, d || 1, isFinite(hh) ? hh : 17, isFinite(mm) ? mm : 0, 0, 0);
    onChange(local.toISOString());
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    emitChange(e.target.value, timeInputValue);
  };
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    emitChange(dateInputValue, e.target.value);
  };

  // Flash the whole countdown panel when there's less than 24 hours left
  // (covers overdue too, since c.totalMs goes <= 0). Computed at the root
  // so the urgent class lives on the bordered card itself.
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const urgent = !!c && c.totalMs < ONE_DAY_MS;

  const isDark = variant === "dark";
  const subText = isDark ? "text-zinc-400" : "text-muted-foreground";
  const dim = isDark ? "text-zinc-500" : "text-muted-foreground/60";
  const accent = c?.overdue ? "text-red-500" : isDark ? "text-yellow-400" : "text-foreground";
  const chipBase = isDark
    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
    : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={`rounded-md border px-3 py-2 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-card"} no-print ${urgent ? "countdown-panel-urgent" : ""}`}
      style={{ containerType: "inline-size" }}
      data-testid="due-by-countdown"
      data-urgent={urgent || undefined}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-widest ${subText} leading-tight`}>
            Due<br/>By
          </span>
          {(() => {
            // Unit columns — digit on top, short label centred beneath. Reads like
            // a regular countdown clock. Digit size scales with the container so
            // five columns + colons + label always fit, no matter the card width.
            const units: { value: string; label: string; highlight?: boolean }[] = c
              ? [
                  { value: pad(c.weeks),   label: "wks"  },
                  { value: pad(c.days),    label: "days" },
                  { value: pad(c.hours),   label: "hrs"  },
                  { value: pad(c.minutes), label: "min"  },
                  { value: pad(c.seconds), label: "sec", highlight: true },
                ]
              : [
                  { value: "--", label: "wks"  },
                  { value: "--", label: "days" },
                  { value: "--", label: "hrs"  },
                  { value: "--", label: "min"  },
                  { value: "--", label: "sec"  },
                ];
            const digitColour = c
              ? accent
              : dim;
            const secondsColour = c?.overdue
              ? "text-red-500"
              : isDark ? "text-yellow-300" : "text-foreground/80";
            // Container-relative clamp (cqw = % of this card's own width). On
            // narrow kiosk cards the digits stay small enough to fit; on the
            // wide build-sheet card they grow back to a chunky readable size.
            const digitClass = "font-mono font-bold tabular-nums leading-none text-[clamp(1rem,6.5cqw,2rem)]";
            const colonClass = "font-mono font-bold leading-none text-[clamp(1rem,6.5cqw,2rem)] self-center";
            return (
              <div
                className="flex items-end gap-1 min-w-0 flex-1"
                data-testid={c ? "text-countdown" : "text-countdown-empty"}
                title={c?.overdue ? "Overdue" : c ? "Time until due date" : undefined}
              >
                {units.map((u, i) => (
                  <div key={u.label} className="flex items-end gap-1 min-w-0">
                    <div className="flex flex-col items-center leading-none min-w-0">
                      <span
                        className={`${digitClass} ${u.highlight && c ? secondsColour : digitColour}`}
                        data-testid={u.label === "sec" && c ? "text-countdown-seconds" : undefined}
                      >
                        {u.value}
                      </span>
                      <span className={`text-[clamp(7px,1.8cqw,10px)] uppercase tracking-wider mt-1 ${dim} whitespace-nowrap px-0.5`}>
                        {u.label}
                      </span>
                    </div>
                    {i < units.length - 1 && (
                      <span className={`${colonClass} ${dim} pb-3`}>:</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {c?.overdue && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-red-500 text-white" data-testid="chip-overdue">
              Overdue
            </span>
          )}
          {showSixWeekChip && sixWeekDate && (
            <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded border ${chipBase}`} data-testid="chip-6wk">
              6wk · {fmtDate(sixWeekDate)}
            </span>
          )}
          {nineWeekDate && (
            <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded border ${chipBase}`} data-testid="chip-9wk">
              9wk · {fmtDate(nineWeekDate)}
            </span>
          )}
          {editable && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateInputValue}
                onChange={handleDateChange}
                className={`text-xs rounded border px-2 py-1 ${
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-200" : "bg-background border-input"
                }`}
                data-testid="input-target-completion-date"
                title="Edit collection date"
              />
              <input
                type="time"
                value={timeInputValue}
                onChange={handleTimeChange}
                disabled={!dateInputValue}
                className={`text-xs rounded border px-2 py-1 ${
                  isDark ? "bg-zinc-900 border-zinc-700 text-zinc-200" : "bg-background border-input"
                } disabled:opacity-50`}
                data-testid="input-target-completion-time"
                title="Collection time (defaults to 5pm)"
              />
            </div>
          )}
          {seeded && !editable && (
            <span className={`text-[9px] uppercase tracking-wider ${dim}`} title="Auto-set from artwork approval + 9 weeks">auto</span>
          )}
        </div>
      </div>

      {/* Collection date/time on its own row beneath the countdown so the
          numbers up top have full width to themselves. */}
      {!editable && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {target ? (
            <span className={`text-xs font-medium ${subText}`} data-testid="text-target-date">
              {fmtDate(target)} · {target.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span className={`text-xs ${dim}`}>No date set</span>
          )}
        </div>
      )}
    </div>
  );
}
