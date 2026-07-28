import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: any) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(email.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO
        title="Forgot Password | Mobile Tyre Vans"
        description="Reset your Mobile Tyre Vans account password."
        noindex={true}
      />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            {submitted ? (
              <CheckCircle className="w-12 h-12 text-accent" />
            ) : (
              <Mail className="w-12 h-12 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl text-center">
            {submitted ? "Check your email" : "Forgot password?"}
          </CardTitle>
          <CardDescription className="text-center">
            {submitted
              ? "If that email address is registered, we've sent a reset link. Check your inbox — it may take a minute."
              : "Enter your email address and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  data-testid="input-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="button-send-reset"
              >
                {mutation.isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          ) : (
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground mb-6">
                The link expires after 1 hour. If you don't see the email, check your spam folder.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSubmitted(false); setEmail(""); }}
                data-testid="button-try-again"
              >
                Try a different email
              </Button>
            </div>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" />
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
