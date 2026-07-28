import { useState } from "react";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import { buildShareUrl, hasAnythingSelected } from "@/lib/configuratorShare";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Share2, Check, CheckCircle } from "lucide-react";

interface Step {
  title: string;
  path: string;
}

const BASE_STEPS: Step[] = [
  { title: "Van", path: "/configurator/van" },
  { title: "Service Type", path: "/configurator/service-type" },
];

const KIT_STEP: Step = { title: "Kit", path: "/configurator/kit" };

const LATER_STEPS: Step[] = [
  { title: "Upgrades", path: "/configurator/upgrades" },
  { title: "Finance", path: "/configurator/finance" },
  { title: "Quote", path: "/configurator/quote" },
];

function useConfiguratorSteps() {
  const { state } = useConfigurator();
  const isCommercial = state.serviceType === "commercial";
  return [
    ...BASE_STEPS,
    ...(isCommercial ? [] : [KIT_STEP]),
    ...LATER_STEPS,
  ];
}

interface ConfiguratorStepperProps {
  currentPath: string;
}

export default function ConfiguratorStepper({ currentPath }: ConfiguratorStepperProps) {
  const steps = useConfiguratorSteps();
  const { slotA } = useConfigurator();
  const [copied, setCopied] = useState(false);

  const totalSteps = steps.length;
  const currentIndex = steps.findIndex(s => s.path === currentPath);

  if (currentIndex < 0) return null;

  const currentStep = currentIndex + 1;
  const pct = Math.round((currentStep / totalSteps) * 100);

  const canShare = hasAnythingSelected(slotA);

  const handleShare = async () => {
    const url = buildShareUrl(slotA);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="mb-6" data-testid="configurator-stepper">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" data-testid="text-step-indicator">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-foreground">
            {steps[currentIndex]?.title}
          </span>
          {canShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className={`h-7 px-2 gap-1.5 text-xs transition-colors ${copied ? 'text-accent' : 'text-muted-foreground'}`}
              data-testid="button-share-config"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
          data-testid="progress-bar"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        />
      </div>
      {/* Step indicators */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div key={step.path} className="flex items-center gap-1">
              {isCompleted ? (
                <Link
                  href={step.path}
                  className="flex items-center gap-1 text-[10px] text-accent font-medium hover:underline"
                  data-testid={`step-link-${idx}`}
                >
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                  {step.title}
                </Link>
              ) : (
                <span
                  className={`text-[10px] font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}
                  data-testid={`step-label-${idx}`}
                >
                  {step.title}
                </span>
              )}
              {idx < steps.length - 1 && (
                <span className="text-muted-foreground/40 text-[10px] mx-0.5">›</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
