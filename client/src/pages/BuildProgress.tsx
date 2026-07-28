import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Wrench, Phone } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type CustomerBuildProgressData = {
  customerName: string;
  vanRegistration: string | null;
  company: string | null;
  stages: Array<{ id: string; label: string; section?: string }>;
  completedStages: Array<{ id: string; initials: string | null }>;
};

const gajoLine = (
  <p className="text-center text-xs text-muted-foreground/60">
    Platform operated by GAJO Creative Ltd
  </p>
);

export default function CustomerBuildProgress() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<CustomerBuildProgressData>({
    queryKey: [`/api/build-progress-public/${token}`],
    queryFn: () => fetchJson(`/api/build-progress-public/${token}`),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          {gajoLine}
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full space-y-6">
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold">Link Not Found</h2>
                <p className="text-muted-foreground text-sm">
                  This build progress link is invalid or has expired. Contact us directly if you need an update on your build.
                </p>
                <a href="tel:08000000000" className="inline-flex items-center gap-2 text-accent font-medium hover:underline text-sm">
                  <Phone className="w-4 h-4" />
                  0800 000 0000
                </a>
              </CardContent>
            </Card>
            {gajoLine}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const completedSet = new Set(data.completedStages.map((s) => s.id));
  const doneCount = data.stages.filter(s => completedSet.has(s.id)).length;
  const totalCount = data.stages.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 px-4 py-12">
        <div className="max-w-lg mx-auto space-y-8">

          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto">
              <Wrench className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Build Progress</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hi {data.customerName.split(" ")[0]}, here's a live view of how your van conversion is progressing.
            </p>
            {data.vanRegistration && (
              <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground">
                {data.vanRegistration}
              </p>
            )}
          </div>

          <div className="space-y-2" data-testid="progress-summary">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{doneCount} of {totalCount} stages complete</span>
              <Badge variant="outline" data-testid="badge-progress-pct">{progressPct}%</Badge>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>

          {allDone ? (
            <Card data-testid="card-all-done">
              <CardContent className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-accent mx-auto" />
                <h2 className="text-xl font-bold">All stages complete!</h2>
                <p className="text-muted-foreground text-sm">
                  Your van conversion is finished. Our team will be in touch to arrange handover.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2" data-testid="stage-list">
              {data.stages.map((stage, idx) => {
                const isComplete = completedSet.has(stage.id);
                const prevSection = idx > 0 ? data.stages[idx - 1].section : undefined;
                const showSectionHeader = stage.section && stage.section !== prevSection;
                return (
                  <div key={stage.id}>
                    {showSectionHeader && (
                      <p
                        className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        data-testid={`section-header-${stage.section!.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {stage.section}
                      </p>
                    )}
                    <div
                      className={[
                        "flex items-center gap-3 rounded-md px-4 py-3 text-sm",
                        isComplete ? "bg-accent/10 text-foreground" : "bg-muted/30 text-muted-foreground",
                      ].join(" ")}
                      data-testid={`stage-${stage.id}`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                      ) : (
                        <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0 block" />
                      )}
                      <span className={isComplete ? "line-through" : ""}>{stage.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Need an update?{" "}
            <a href="tel:08000000000" className="text-accent font-medium hover:underline">
              Call 0800 000 0000
            </a>
          </p>

          {gajoLine}
        </div>
      </div>
      <Footer />
    </div>
  );
}
