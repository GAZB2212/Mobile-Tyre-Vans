import { useConfigurator } from "@/lib/ConfiguratorContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RotateCcw } from "lucide-react";

export function CompareSlotToggle() {
  const { compareMode, activeSlot, setActiveSlot, clearSlotA, clearSlotB } = useConfigurator();

  if (!compareMode) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-md border mb-4" data-testid="compare-slot-toggle">
      <span className="text-sm font-medium text-muted-foreground mr-1">Configuring:</span>
      <Button
        variant={activeSlot === 'A' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveSlot('A')}
        className={activeSlot === 'A' ? 'bg-accent text-accent-foreground' : '!border-2 !border-accent text-accent'}
        data-testid="button-slot-a"
      >
        Option A
      </Button>
      <Button
        variant={activeSlot === 'B' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveSlot('B')}
        className={activeSlot === 'B' ? 'bg-accent text-accent-foreground' : '!border-2 !border-accent text-accent'}
        data-testid="button-slot-b"
      >
        Option B
      </Button>
      <div className="flex-1" />
      <Badge variant="secondary" className="text-xs" data-testid="badge-compare-mode">
        Comparison Mode
      </Badge>
      {/* Per-slot reset: clear the currently active slot's config */}
      <Button
        variant="ghost"
        size="icon"
        onClick={activeSlot === 'A' ? clearSlotA : clearSlotB}
        title={activeSlot === 'A' ? "Reset Option A configuration" : "Remove Option B and exit comparison mode"}
        data-testid={activeSlot === 'A' ? "button-clear-slot-a" : "button-clear-slot-b"}
      >
        {activeSlot === 'A' ? <RotateCcw className="w-4 h-4" /> : <X className="w-4 h-4" />}
      </Button>
    </div>
  );
}
