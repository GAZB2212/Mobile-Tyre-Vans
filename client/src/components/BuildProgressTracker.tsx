import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BuildStage {
  id: string;
  label: string;
}

interface BuildProgressTrackerProps {
  completedStages: string[];
  stages: BuildStage[];
}

export default function BuildProgressTracker({ completedStages, stages }: BuildProgressTrackerProps) {
  const completedCount = stages.filter(s => completedStages.includes(s.id)).length;
  const totalCount = stages.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Build Progress
        </CardTitle>
        <CardDescription>
          {totalCount === 0
            ? "No build stages defined"
            : allDone
            ? "All stages complete — van is ready"
            : completedCount === 0
            ? "Build has not started yet"
            : "Track progress through each build stage"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stages.map((stage) => {
            const isComplete = completedStages.includes(stage.id);

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 py-2.5 px-3 rounded-md",
                  isComplete ? "bg-accent/10" : "bg-muted/30"
                )}
                data-testid={`stage-${stage.id}`}
              >
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    isComplete ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
                {isComplete && (
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-complete-${stage.id}`}>
                    Done
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {totalCount > 0 && (
          <div className="mt-5 pt-4 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold" data-testid="progress-percent">
                {progressPercent}% &mdash; {completedCount} of {totalCount} stages
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
