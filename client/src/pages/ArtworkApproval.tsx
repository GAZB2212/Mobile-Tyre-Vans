import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Loader2, Phone, ZoomIn, MessageCircle, Send } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type ArtworkInfo = {
  customerName: string;
  files: Array<{ url: string; name: string }>;
  status: "pending_review" | "approved" | "changes_requested" | null;
  customerNotes: string | null;
  adminNotes: string | null;
};

type ArtworkMessage = {
  id: string;
  proofId: string;
  senderType: "admin" | "customer";
  senderName: string;
  message: string;
  createdAt: string;
};

function CustomerChatThread({ token, customerName }: { token: string; customerName: string }) {
  const [compose, setCompose] = useState("");
  const [localMessages, setLocalMessages] = useState<ArtworkMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery<ArtworkMessage[]>({
    queryKey: [`/api/artwork-approval/${token}/messages`],
    refetchInterval: 20000,
  });

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages.length]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/artwork-approval/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, senderName: customerName }),
      });
      if (!r.ok) throw new Error("Failed to send");
      return r.json() as Promise<ArtworkMessage>;
    },
    onSuccess: (newMsg) => {
      setCompose("");
      setLocalMessages(prev => [...prev, newMsg]);
      setTimeout(() => refetch(), 500);
    },
  });

  const handleSend = () => {
    if (compose.trim()) sendMutation.mutate(compose.trim());
  };

  const allMessages = localMessages.length >= messages.length ? localMessages : messages;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Discussion</h2>
        {allMessages.length > 0 && (
          <Badge variant="outline" className="text-xs no-default-active-elevate">
            {allMessages.length}
          </Badge>
        )}
      </div>

      {allMessages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Have a question or want to discuss the artwork? Send a message below — our graphics team will reply.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {allMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${msg.senderType === "customer" ? "items-end" : "items-start"}`}
            >
              <div className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                msg.senderType === "customer"
                  ? "bg-accent/10 text-foreground"
                  : "bg-muted text-foreground"
              }`}>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  {msg.senderType === "customer" ? "You" : msg.senderName}
                </p>
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                {new Date(msg.createdAt).toLocaleString("en-GB", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          className="resize-none flex-1"
          style={{ minHeight: "80px" }}
          placeholder="Type a message to our graphics team…"
          value={compose}
          onChange={e => setCompose(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && compose.trim()) {
              e.preventDefault();
              handleSend();
            }
          }}
          data-testid="textarea-chat-message"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!compose.trim() || sendMutation.isPending}
          className="bg-accent text-accent-foreground self-end"
          data-testid="button-send-chat"
        >
          {sendMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </Button>
      </div>
      {sendMutation.isError && (
        <p className="text-sm text-destructive">Failed to send — please try again.</p>
      )}
      <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
    </div>
  );
}

export default function ArtworkApproval() {
  const { token } = useParams<{ token: string }>();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedStatus = params.get("status") as "approved" | "changes_requested" | null;

  const [selectedStatus, setSelectedStatus] = useState<"approved" | "changes_requested" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: info, isLoading, error } = useQuery<ArtworkInfo>({
    queryKey: [`/api/artwork-approval/${token}`],
    enabled: !!token,
  });

  useEffect(() => {
    if (preselectedStatus === "approved" || preselectedStatus === "changes_requested") {
      setSelectedStatus(preselectedStatus);
    }
  }, [preselectedStatus]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/artwork-approval/${token}`, {
        approved: selectedStatus === "approved",
        notes: notes.trim() || undefined,
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
                  This approval link is invalid or has expired. Please contact us directly if you need to review your artwork.
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

  const alreadyAnswered = info.status !== null && info.status !== "pending_review";
  const finalStatus = submitted ? selectedStatus : (alreadyAnswered ? info.status : null);
  const isApproved = finalStatus === "approved";

  if (submitted || alreadyAnswered) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 px-4 py-12">
          <div className="max-w-2xl mx-auto space-y-8">
            <Card data-testid="card-artwork-submitted">
              <CardContent className="py-12 text-center space-y-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto ${isApproved ? "bg-accent/10" : "bg-orange-500/10"}`}>
                  {isApproved
                    ? <CheckCircle className="w-8 h-8 text-accent" />
                    : <XCircle className="w-8 h-8 text-orange-500" />
                  }
                </div>

                <Badge variant="outline" className={isApproved ? "border-accent text-accent" : "border-orange-500 text-orange-500"}>
                  {isApproved ? "Artwork Approved" : "Changes Requested"}
                </Badge>

                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {isApproved
                      ? `Thanks, ${info.customerName.split(" ")[0]}!`
                      : `Got it, ${info.customerName.split(" ")[0]}`
                    }
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {isApproved
                      ? "We've noted that you're happy with the artwork. Our team will move forward with production."
                      : "We've received your feedback and a member of our team will review it and be in touch to discuss the changes."
                    }
                  </p>
                </div>

                {!isApproved && (info.customerNotes || notes) && (
                  <div className="text-left bg-muted rounded-md p-4 text-sm">
                    <p className="font-medium text-foreground mb-1">Your notes:</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{info.customerNotes || notes}</p>
                  </div>
                )}

                <a href="tel:08000000000" className="inline-flex items-center gap-2 text-accent font-medium hover:underline text-sm pt-2">
                  <Phone className="w-4 h-4" />
                  0800 000 0000
                </a>
              </CardContent>
            </Card>

            {/* Chat thread still accessible after approval */}
            <CustomerChatThread token={token!} customerName={info.customerName} />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const canSubmit = selectedStatus !== null && (selectedStatus === "approved" || notes.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">

          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">
              Hi {info.customerName.split(" ")[0]},
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your artwork proof is ready to review. Please check the files below and let us know if everything looks good.
            </p>
          </div>

          {info.adminNotes && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-4 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">Note from our team</p>
              <p className="text-blue-800 dark:text-blue-300 whitespace-pre-wrap">{info.adminNotes}</p>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-base font-semibold">Artwork Files</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {info.files.map((f, i) => (
                <div key={i} className="space-y-1" data-testid={`artwork-file-${i}`}>
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(f.url)}
                    className="relative w-full rounded-md overflow-hidden border border-border bg-muted group hover-elevate"
                  >
                    <img
                      src={f.url}
                      alt={f.name}
                      className="w-full object-contain max-h-64"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                  <p className="text-xs text-muted-foreground truncate" title={f.name}>{f.name}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click any image to view it full size.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <p className="font-semibold text-sm leading-snug">Looks good — approve</p>
              <p className="text-xs text-muted-foreground mt-1">I'm happy with the artwork</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatus("changes_requested")}
              data-testid="button-request-changes"
              className={[
                "rounded-md p-5 border text-left transition-all duration-150",
                selectedStatus === "changes_requested"
                  ? "border-orange-500 ring-2 ring-orange-500 bg-orange-500/5"
                  : "border-border bg-card hover-elevate",
              ].join(" ")}
            >
              <XCircle className={`w-6 h-6 mb-3 ${selectedStatus === "changes_requested" ? "text-orange-500" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm leading-snug">Request changes</p>
              <p className="text-xs text-muted-foreground mt-1">Something needs adjusting</p>
            </button>
          </div>

          {selectedStatus === "changes_requested" && (
            <div className="space-y-2" data-testid="section-notes">
              <label htmlFor="artwork-notes" className="text-sm font-medium block">
                What needs changing? <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="artwork-notes"
                data-testid="textarea-notes"
                placeholder="e.g. The phone number is wrong, please use 07700 123456..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {selectedStatus !== null && (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit || submitMutation.isPending}
              size="lg"
              className="w-full bg-accent text-accent-foreground"
              data-testid="button-submit"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : selectedStatus === "approved" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm — artwork looks good
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
            <p className="text-sm text-destructive text-center" data-testid="text-error">
              Something went wrong. Please try again or call us on 0800 000 0000.
            </p>
          )}

          {/* Discussion thread */}
          <div className="border-t pt-6">
            <CustomerChatThread token={token!} customerName={info.customerName} />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Prefer to speak to someone?{" "}
            <a href="tel:08000000000" className="text-accent font-medium hover:underline">
              Call 0800 000 0000
            </a>
          </p>
        </div>
      </div>
      <Footer />

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          data-testid="lightbox"
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={lightboxUrl}
              alt="Artwork full size"
              className="max-w-full max-h-[90vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition-colors"
              data-testid="button-close-lightbox"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
