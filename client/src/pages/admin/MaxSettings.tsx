import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, Save, RotateCcw, Lightbulb } from "lucide-react";
import type { User } from "@shared/schema";

const SETTING_KEY = "max_business_context";

const PLACEHOLDER = `Examples of useful context to add:

- We cover all of Merseyside, Cheshire, and North Wales. We can travel further for the right order.
- Our lead time for a full conversion is typically 6–8 weeks from deposit.
- We offer a 12-month warranty on all equipment installed.
- Our main competitors are [Company A] and [Company B] — we differentiate on service, speed, and UK-made quality.
- Customers who ask about leasing should be told minimum term is 36 months.
- Finance approvals typically take 24–48 hours.
- We do NOT do trailer units — only van-mounted conversions.
- Common objection: "too expensive" — remind them the van pays for itself in the first year compared to a fixed site.
- Staff contact: Sales — 0800 000 0000, WhatsApp also available.`;

export default function MaxSettings() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();
  const isFullAdmin = user?.adminRole === "full";

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [context, setContext] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setContext(settings[SETTING_KEY] ?? "");
      setIsDirty(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/admin/site-settings/${SETTING_KEY}`, { value: context }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      setIsDirty(false);
      toast({ title: "Saved", description: "Max's business context has been updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save. Please try again." });
    },
  });

  const handleReset = () => {
    const original = settings?.[SETTING_KEY] ?? "";
    setContext(original);
    setIsDirty(false);
  };

  if (!isFullAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">You do not have permission to view this page.</p>
      </div>
    );
  }

  const charCount = context.length;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Max AI Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Teach Max about your business so he can answer customer questions more accurately and sell more effectively.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">Business Context</CardTitle>
            </div>
            {charCount > 0 && (
              <Badge
                variant="outline"
                className="text-muted-foreground no-default-active-elevate"
                data-testid="badge-char-count"
              >
                {charCount.toLocaleString()} characters
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1">
            Anything you write here is injected directly into Max's knowledge on every conversation. Write it like
            notes to a new salesperson — plain English, bullet points, whatever is clearest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 border p-3 flex gap-2.5">
            <Lightbulb className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Good things to include: coverage area, lead times, warranty, common objections and how to handle them,
              finance details, what you <em>don't</em> do, competitor differences, staff contacts, and any local
              knowledge that helps close a sale.
            </p>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-md bg-muted/30 animate-pulse" />
          ) : (
            <Textarea
              data-testid="textarea-max-context"
              value={context}
              onChange={e => {
                setContext(e.target.value);
                setIsDirty(true);
              }}
              placeholder={PLACEHOLDER}
              className="min-h-[320px] text-sm font-mono leading-relaxed resize-y"
            />
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Changes take effect on the next conversation Max starts — cached sessions update within 5 minutes.
            </p>
            <div className="flex gap-2">
              {isDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={saveMutation.isPending}
                  data-testid="button-reset-context"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Discard
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !isDirty}
                data-testid="button-save-context"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
