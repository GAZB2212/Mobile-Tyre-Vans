import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Loader2, Phone } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type ApprovalInfo = {
  ref: string;
  customerName: string;
  specApprovalStatus: "approved" | "rejected" | null;
  specApprovalComments: string | null;
  upgrades: Array<{ name: string; quantity: number }>;
};

export default function SpecApproval() {
  const { token } = useParams<{ token: string }>();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedStatus = params.get("status") as "approved" | "rejected" | null;

  const [selectedStatus, setSelectedStatus] = useState<"approved" | "rejected" | null>(null);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: info, isLoading, error } = useQuery<ApprovalInfo>({
    queryKey: [`/api/spec-approval/${token}`],
    enabled: !!token,
  });

  useEffect(() => {
    if (preselectedStatus === "approved" || preselectedStatus === "rejected") {
      setSelectedStatus(preselectedStatus);
    }
  }, [preselectedStatus]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/spec-approval/${token}`, {
        status: selectedStatus,
        comments: comments.trim() || undefined,
      });
    },
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-center text-xs text-muted-foreground/60">Platform operated by GAJO Creative Ltd</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !info) {
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
                  This approval link is invalid or has expired. Contact us directly if you need to give feedback on your specification.
                </p>
                <a href="tel:08000000000" className="inline-flex items-center gap-2 text-accent font-medium hover:underline text-sm">
                  <Phone className="w-4 h-4" />
                  0800 000 0000
                </a>
              </CardContent>
            </Card>
            <p className="text-center text-xs text-muted-foreground/60">Platform operated by GAJO Creative Ltd</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const alreadyAnswered = info.specApprovalStatus !== null;
  const finalStatus = submitted ? selectedStatus : info.specApprovalStatus;
  const isApproved = finalStatus === "approved";

  if (submitted || alreadyAnswered) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-lg w-full space-y-6">
            <Card data-testid="card-approval-submitted">
              <CardContent className="py-12 text-center space-y-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto ${isApproved ? "bg-accent/10" : "bg-orange-500/10"}`}>
                  {isApproved
                    ? <CheckCircle className="w-8 h-8 text-accent" />
                    : <XCircle className="w-8 h-8 text-orange-500" />
                  }
                </div>

                <Badge variant="outline" className={isApproved ? "border-accent text-accent" : "border-orange-500 text-orange-500"}>
                  {isApproved ? "Confirmed" : "Feedback Received"}
                </Badge>

                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {isApproved ? `Thanks, ${info.customerName.split(" ")[0]}!` : `Got it, ${info.customerName.split(" ")[0]}`}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {isApproved
                      ? "We've noted that your specification looks correct. Our team will be in touch shortly to progress your order."
                      : "We've received your feedback and a member of our team will review it and be in touch to discuss the changes."
                    }
                  </p>
                </div>

                {!isApproved && (info.specApprovalComments || comments) && (
                  <div className="text-left bg-muted rounded-md p-4 text-sm">
                    <p className="font-medium text-foreground mb-1">Your comments:</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{info.specApprovalComments || comments}</p>
                  </div>
                )}

                <a href="tel:08000000000" className="inline-flex items-center gap-2 text-accent font-medium hover:underline text-sm pt-2">
                  <Phone className="w-4 h-4" />
                  0800 000 0000
                </a>
              </CardContent>
            </Card>
            <p className="text-center text-xs text-muted-foreground/60">Platform operated by GAJO Creative Ltd</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const canSubmit = selectedStatus !== null && (selectedStatus === "approved" || comments.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground font-mono tracking-wider uppercase">
              Reference #{info.ref}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Hi {info.customerName.split(" ")[0]},
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Please let us know whether the van conversion specification we discussed looks correct.
            </p>
          </div>

          {/* Upgrade summary */}
          {info.upgrades && info.upgrades.length > 0 && (
            <Card data-testid="card-spec-upgrades">
              <CardContent className="py-4 px-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your Equipment</p>
                <ul className="space-y-1.5">
                  {info.upgrades.map((upgrade, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 text-sm" data-testid={`item-upgrade-${i}`}>
                      <span className="text-foreground">{((upgrade as any).variantName && (upgrade as any).variantName.trim()) || upgrade.name}</span>
                      {upgrade.quantity > 1 && (
                        <span className="text-accent font-medium whitespace-nowrap" data-testid={`text-upgrade-qty-${i}`}>
                          ×{upgrade.quantity}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Choice cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Approve */}
            <button
              type="button"
              onClick={() => setSelectedStatus("approved")}
              data-testid="button-approve"
              className={[
                "rounded-md p-5 border text-left transition-all duration-150",
                selectedStatus === "approved"
                  ? "border-accent ring-2 ring-accent bg-accent/5"
                  : "border-border bg-card hover-elevate",
              ].join(" ")}
            >
              <CheckCircle className={`w-6 h-6 mb-3 ${selectedStatus === "approved" ? "text-accent" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm leading-snug">This looks correct</p>
              <p className="text-xs text-muted-foreground mt-1">I'm happy with the spec</p>
            </button>

            {/* Reject */}
            <button
              type="button"
              onClick={() => setSelectedStatus("rejected")}
              data-testid="button-reject"
              className={[
                "rounded-md p-5 border text-left transition-all duration-150",
                selectedStatus === "rejected"
                  ? "border-orange-500 ring-2 ring-orange-500 bg-orange-500/5"
                  : "border-border bg-card hover-elevate",
              ].join(" ")}
            >
              <XCircle className={`w-6 h-6 mb-3 ${selectedStatus === "rejected" ? "text-orange-500" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm leading-snug">Something needs changing</p>
              <p className="text-xs text-muted-foreground mt-1">I'd like to flag an issue</p>
            </button>
          </div>

          {/* Comments — shown only when rejecting */}
          {selectedStatus === "rejected" && (
            <div className="space-y-2" data-testid="section-comments">
              <label htmlFor="comments" className="text-sm font-medium block">
                What needs changing? <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="comments"
                data-testid="textarea-comments"
                placeholder="e.g. The compressor type is wrong, I wanted the 12V version..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {/* Submit */}
          {selectedStatus !== null && (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit || submitMutation.isPending}
              size="lg"
              className="w-full bg-accent text-accent-foreground"
              data-testid="button-submit-approval"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : selectedStatus === "approved" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm — this is correct
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Send my feedback
                </>
              )}
            </Button>
          )}

          {submitMutation.isError && (
            <p className="text-sm text-destructive text-center" data-testid="text-approval-error">
              Something went wrong. Please try again or call us on 0800 000 0000.
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Prefer to speak to someone?{" "}
            <a href="tel:08000000000" className="text-accent font-medium hover:underline">
              Call 0800 000 0000
            </a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
