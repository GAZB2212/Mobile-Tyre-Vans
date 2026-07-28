import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, fetchJson } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Wrench, CircleDot, Pencil, ChevronDown, ChevronUp, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type CompletedStage = { id: string; initials: string };

interface SkuComponent {
  sku: string;
  description: string;
  quantity: number;
}

interface BuildProgressData {
  id: string;
  userName: string;
  company: string | null;
  vanRegistration: string | null;
  status: string;
  customBuildStages: Array<{ id: string; label: string; section?: string }> | null;
  completedBuildStages: Array<string | { id: string; initials: string }>;
  kit: { id: string; name: string; sku: string | null; skuComponents: SkuComponent[] | null } | null;
  upgrades: Array<{ id: string; name: string; category: string; variantName: string | null; sku: string | null; skuComponents: SkuComponent[] | null }>;
}

interface ActiveStage {
  id: string;
  label: string;
  section?: string;
  sku?: string | null;
  skuComponents?: SkuComponent[] | null;
}

const INITIALS_KEY = "build_progress_initials";

export default function BuildProgress() {
  const { id: quoteId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<BuildProgressData>({
    queryKey: ["/api/build-progress", quoteId],
    queryFn: () => fetchJson(`/api/build-progress/${quoteId}`),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const [completedStages, setCompletedStages] = useState<CompletedStage[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedBom, setExpandedBom] = useState<Set<string>>(new Set());

  const [initials, setInitials] = useState<string>(() =>
    (localStorage.getItem(INITIALS_KEY) || "").toUpperCase()
  );
  const [editingInitials, setEditingInitials] = useState(false);
  const [initialsInput, setInitialsInput] = useState("");

  const normalizeStages = (raw: BuildProgressData["completedBuildStages"]): CompletedStage[] =>
    (raw ?? []).map((s) =>
      typeof s === "string" ? { id: s, initials: "" } : s
    );

  useEffect(() => {
    if (data && !saveMutation.isPending) {
      setCompletedStages(normalizeStages(data.completedBuildStages));
    }
  }, [data]);

  const autoGenerateStages = (
    kit: BuildProgressData["kit"],
    upgrades: BuildProgressData["upgrades"]
  ): ActiveStage[] => {
    const upgradeLabel = (u: BuildProgressData["upgrades"][0]) =>
      (u.variantName && u.variantName.trim()) ? u.variantName.trim() : u.name;
    const interiorWallPattern = /interior.wall/i;
    const wrapGraphicsPattern = /wrap|graphic/i;
    const isInteriorWall = (u: { name: string; category: string }) =>
      interiorWallPattern.test(u.name) || interiorWallPattern.test(u.category);
    const isWrapGraphics = (u: { name: string; category: string }) =>
      wrapGraphicsPattern.test(u.name) || wrapGraphicsPattern.test(u.category);
    const stages: ActiveStage[] = [];
    stages.push({ id: "prep", label: "Van Preparation" });
    if (kit) stages.push({ id: "kit", label: `Install ${kit.name}`, sku: kit.sku, skuComponents: kit.skuComponents });
    const nonWrap = upgrades.filter((u) => !isWrapGraphics(u) && !isInteriorWall(u));
    const wrap = upgrades.filter((u) => isWrapGraphics(u) && !isInteriorWall(u));
    const wallUpgrades = upgrades.filter((u) => isInteriorWall(u) && !isWrapGraphics(u));
    for (const u of nonWrap) stages.push({ id: `upg_${u.id}`, label: upgradeLabel(u), sku: u.sku, skuComponents: u.skuComponents });
    if (wrap.length > 0) {
      stages.push({ id: "artwork_sent", label: "Artwork Sent", section: "Design Work" });
      stages.push({ id: "artwork_approved", label: "Artwork Approved", section: "Design Work" });
      stages.push({ id: "wrap_printed", label: "Wrap Printed", section: "Design Work" });
    }
    for (const u of wrap) stages.push({ id: `upg_${u.id}`, label: upgradeLabel(u), sku: u.sku, skuComponents: u.skuComponents });
    if (wallUpgrades.length > 0) {
      stages.push({ id: "interior_walls_artwork_sent", label: "Interior Walls Artwork Sent", section: "Design Work" });
      stages.push({ id: "interior_wall_artwork_approved", label: "Interior Wall Artwork Approved", section: "Design Work" });
      stages.push({ id: "interior_walls_ordered", label: "Interior Walls Ordered", section: "Design Work" });
    }
    for (const u of wallUpgrades) stages.push({ id: `upg_${u.id}`, label: upgradeLabel(u), sku: u.sku, skuComponents: u.skuComponents });
    stages.push({ id: "final_checks", label: "Final Checks" });
    stages.push({ id: "valet", label: "Valet & Handover" });
    return stages;
  };

  const activeStages: ActiveStage[] =
    data
      ? data.customBuildStages && data.customBuildStages.length > 0
        ? data.customBuildStages
        : autoGenerateStages(data.kit, data.upgrades)
      : [];

  const isStageComplete = (stageId: string) => completedStages.some((s) => s.id === stageId);
  const getStageInitials = (stageId: string) => completedStages.find((s) => s.id === stageId)?.initials ?? "";

  const saveMutation = useMutation({
    mutationFn: async (updated: CompletedStage[]) => {
      const res = await fetch(`/api/build-progress/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBuildStages: updated }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/build-progress", quoteId] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save. Please try again.", variant: "destructive" });
    },
  });

  const handleStagePress = (stageId: string) => {
    if (isStageComplete(stageId)) {
      const who = getStageInitials(stageId);
      if (who && who !== initials) {
        toast({
          title: `Completed by ${who}`,
          description: "Only the person who completed this stage can undo it.",
          variant: "destructive",
        });
        return;
      }
      const updated = completedStages.filter((s) => s.id !== stageId);
      setCompletedStages(updated);
      setPendingId(null);
      saveMutation.mutate(updated);
      return;
    }
    setPendingId((prev) => (prev === stageId ? null : stageId));
  };

  const handleConfirmSave = () => {
    if (!pendingId) return;
    const entry: CompletedStage = { id: pendingId, initials: initials.toUpperCase().slice(0, 3) };
    const updated = [...completedStages, entry];
    setCompletedStages(updated);
    setPendingId(null);
    const label = activeStages.find((s) => s.id === pendingId)?.label;
    saveMutation.mutate(updated);
    toast({ title: "Stage marked complete", description: label });
  };

  const handleSaveInitials = () => {
    const trimmed = initialsInput.toUpperCase().slice(0, 3).trim();
    if (trimmed) {
      setInitials(trimmed);
      localStorage.setItem(INITIALS_KEY, trimmed);
    }
    setEditingInitials(false);
  };

  const toggleBom = (e: React.MouseEvent, stageId: string) => {
    e.stopPropagation();
    setExpandedBom((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const doneCount = completedStages.filter((s) => activeStages.some((a) => a.id === s.id)).length;
  const totalCount = activeStages.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8bc440] mx-auto" />
          <p className="mt-3 text-muted-foreground text-sm">Loading build stages...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Build not found. Check the QR code and try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#191919] flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 px-4 py-4 flex items-center gap-3">
        <Wrench className="w-5 h-5 text-[#8bc440] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {data.userName}{data.company ? ` — ${data.company}` : ""}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {data.vanRegistration
              ? <span className="font-mono uppercase tracking-widest">{data.vanRegistration}</span>
              : "Build Stage Progress"}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs" data-testid="badge-progress-pct">
          {progressPct}%
        </Badge>
      </div>

      {/* Initials bar */}
      <div className="border-b border-border/20 px-4 py-2 bg-muted/10 flex items-center gap-2 flex-wrap">
        {editingInitials ? (
          <>
            <Input
              className="h-7 w-20 text-xs font-mono uppercase"
              placeholder="e.g. JD"
              maxLength={3}
              value={initialsInput}
              onChange={(e) => setInitialsInput(e.target.value.toUpperCase().slice(0, 3))}
              onKeyDown={(e) => e.key === "Enter" && handleSaveInitials()}
              autoFocus
              data-testid="input-initials"
            />
            <Button size="sm" className="h-7 text-xs bg-[#8bc440] text-[#191919]" onClick={handleSaveInitials} data-testid="button-save-initials">
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingInitials(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">Your initials:</span>
            {initials ? (
              <Badge variant="secondary" className="text-xs font-mono tracking-wide" data-testid="badge-current-initials">
                {initials}
              </Badge>
            ) : (
              <span className="text-xs text-amber-400 font-medium">Not set</span>
            )}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover-elevate rounded p-0.5"
              onClick={() => { setInitialsInput(initials); setEditingInitials(true); }}
              data-testid="button-edit-initials"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {!initials && (
              <span className="text-xs text-muted-foreground">— set these so your work is tracked</span>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted/40 w-full">
        <div
          className="h-full bg-[#8bc440] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
          data-testid="progress-bar"
        />
      </div>

      {/* Stage list */}
      <div className={cn("flex-1 overflow-y-auto px-4 py-4 space-y-2 max-w-lg mx-auto w-full", pendingId && "pb-28")}>
        {allDone ? (
          <div className="flex flex-col items-center gap-3 py-16" data-testid="all-done-banner">
            <CheckCircle2 className="w-14 h-14 text-[#8bc440]" />
            <span className="text-xl font-bold text-[#8bc440]">All stages complete</span>
            <span className="text-sm text-muted-foreground text-center">
              Every build stage has been ticked off.
            </span>
          </div>
        ) : (
          activeStages.map((stage, idx) => {
            const isComplete = isStageComplete(stage.id);
            const stageInit = getStageInitials(stage.id);
            const isPending = pendingId === stage.id;
            const isLocked = isComplete && !!stageInit && stageInit !== initials;
            const prevSection = idx > 0 ? activeStages[idx - 1].section : undefined;
            const showSectionHeader = stage.section && stage.section !== prevSection;
            const hasBom = !!(stage.skuComponents && stage.skuComponents.length > 0);
            const bomExpanded = expandedBom.has(stage.id);
            return (
              <div key={stage.id}>
                {showSectionHeader && (
                  <div
                    className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    data-testid={`section-header-${stage.section!.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {stage.section}
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-md",
                    isComplete && "bg-[#8bc440]/10",
                    isPending && "bg-amber-500/15 ring-2 ring-amber-400/60",
                    !isComplete && !isPending && "bg-muted/20"
                  )}
                >
                  {/* Stage row — tappable to toggle complete */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 py-4 px-4 text-left transition-all duration-150 active:scale-[0.99]"
                    onClick={() => handleStagePress(stage.id)}
                    data-testid={`toggle-stage-${stage.id}`}
                  >
                    <span className="shrink-0">
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-[#8bc440]" />
                      ) : isPending ? (
                        <CircleDot className="w-5 h-5 text-amber-400" />
                      ) : (
                        <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 block" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium leading-snug",
                        isComplete ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {stage.label}
                      {isPending && (
                        <span className="ml-2 text-xs text-amber-400 font-normal">— tap Save to confirm</span>
                      )}
                    </span>
                    {/* SKU badge */}
                    {stage.sku && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono shrink-0 px-1.5 py-0 h-auto text-muted-foreground border-muted-foreground/30"
                        data-testid={`badge-sku-${stage.id}`}
                      >
                        {stage.sku}
                      </Badge>
                    )}
                    {/* Initials badge */}
                    {isComplete && stageInit && (
                      <Badge
                        variant="secondary"
                        className={cn("text-xs font-mono shrink-0", isLocked && "opacity-60")}
                        data-testid={`badge-initials-${stage.id}`}
                      >
                        {stageInit}
                      </Badge>
                    )}
                    {isComplete && !stageInit && (
                      <span className="w-2 h-2 rounded-full bg-[#8bc440] shrink-0" />
                    )}
                  </button>

                  {/* Parts toggle button — only shown when BOM components exist */}
                  {hasBom && (
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover-elevate rounded px-2 py-1"
                        onClick={(e) => toggleBom(e, stage.id)}
                        data-testid={`button-bom-${stage.id}`}
                      >
                        <List className="w-3 h-3" />
                        Parts ({stage.skuComponents!.length})
                        {bomExpanded
                          ? <ChevronUp className="w-3 h-3 ml-0.5" />
                          : <ChevronDown className="w-3 h-3 ml-0.5" />
                        }
                      </button>

                      {/* Inline BOM table — expands below the button */}
                      {bomExpanded && (
                        <div className="mt-2 border border-border/30 rounded-md overflow-hidden" data-testid={`bom-panel-${stage.id}`}>
                          <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Part</span>
                            <span className="text-right">Qty</span>
                          </div>
                          {stage.skuComponents!.map((part, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2.5 border-t border-border/20"
                              data-testid={`bom-row-${stage.id}-${i}`}
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-mono text-[#8bc440] leading-tight">{part.sku}</p>
                                <p className="text-xs text-foreground leading-snug mt-0.5">{part.description}</p>
                              </div>
                              <span className="text-sm font-semibold text-foreground self-center tabular-nums text-right">{part.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Save confirmation */}
      {pendingId && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#191919] border-t border-amber-400/30 px-4 py-4 flex flex-col gap-2 max-w-lg mx-auto"
          data-testid="save-confirm-bar"
        >
          <p className="text-xs text-amber-400 text-center font-medium truncate">
            {activeStages.find((s) => s.id === pendingId)?.label}
          </p>
          {!initials && (
            <p className="text-xs text-muted-foreground text-center">Set your initials above before saving</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPendingId(null)}
              data-testid="button-cancel-confirm"
            >
              Cancel
            </Button>
            <Button
              className="flex-[2] bg-[#8bc440] text-[#191919] font-bold"
              onClick={handleConfirmSave}
              disabled={saveMutation.isPending || !initials}
              data-testid="button-save-confirm"
            >
              {saveMutation.isPending ? "Saving..." : `Save as ${initials || "??"}`}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      {!allDone && !pendingId && (
        <div className="border-t border-border/40 px-4 py-3 text-center text-xs text-muted-foreground">
          {doneCount} of {totalCount} stages complete · updates every 30s
        </div>
      )}
    </div>
  );
}
