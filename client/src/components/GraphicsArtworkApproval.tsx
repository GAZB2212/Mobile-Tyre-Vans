import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  Clock,
  Image as ImageIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";

interface GraphicsArtworkApprovalProps {
  quote: Quote;
}

export default function GraphicsArtworkApproval({ quote }: GraphicsArtworkApprovalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async (data: { approved: boolean; notes?: string }) => {
      return await apiRequest("POST", `/api/portal/quotes/${quote.id}/approve-artwork`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/portal/quotes/${quote.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/quotes'] });
      toast({
        title: "Success",
        description: showApprovalWarning 
          ? "Artwork approved successfully"
          : "Feedback submitted successfully",
      });
      setNotes("");
      setShowApprovalWarning(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update artwork approval",
      });
    },
  });

  const handleApprove = () => {
    setShowApprovalWarning(true);
  };

  const confirmApproval = () => {
    approveMutation.mutate({ approved: true, notes });
  };

  const handleRequestChanges = () => {
    if (!notes.trim()) {
      toast({
        variant: "destructive",
        title: "Notes Required",
        description: "Please provide details about the changes you'd like",
      });
      return;
    }
    approveMutation.mutate({ approved: false, notes });
  };

  // If no artwork uploaded yet
  if (!quote.graphicsArtworkUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Graphics Artwork
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ImageIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Your graphics artwork has not been uploaded yet. You'll be notified when it's ready for review.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If already approved
  if (quote.graphicsArtworkApproved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Graphics Artwork
          </CardTitle>
          <CardDescription>
            You've approved this artwork design
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <img 
              src={quote.graphicsArtworkUrl} 
              alt="Approved graphics artwork" 
              className="w-full rounded-md border"
              data-testid="img-approved-artwork"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Approved
            </Badge>
          </div>

          {quote.graphicsArtworkNotes && (
            <div>
              <div className="text-sm font-medium mb-1">Your Notes</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {quote.graphicsArtworkNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Pending approval - show approval interface
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Graphics Artwork Approval
        </CardTitle>
        <CardDescription>
          Review your custom graphics design and approve or request changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Artwork Preview */}
        <div>
          <div className="text-sm font-medium mb-2">Design Preview</div>
          <img 
            src={quote.graphicsArtworkUrl} 
            alt="Graphics artwork for approval" 
            className="w-full rounded-md border"
            data-testid="img-artwork-preview"
          />
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-artwork-status">
            <Clock className="w-3 h-3" />
            Awaiting Your Approval
          </Badge>
        </div>

        {/* Approval Warning */}
        {showApprovalWarning && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">Important: Please Review Carefully</div>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Once approved, this design will be printed on your van</li>
                <li>Changes after approval may incur additional costs and delays</li>
                <li>Check all text spelling, colors, and layout carefully</li>
                <li>If you're unsure, request changes or contact us for clarification</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Notes/Feedback Section */}
        {!showApprovalWarning && (
          <div>
            <label htmlFor="artwork-notes" className="text-sm font-medium block mb-2">
              Feedback or Change Requests (Optional)
            </label>
            <Textarea
              id="artwork-notes"
              placeholder="Describe any changes you'd like to see..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              data-testid="textarea-artwork-notes"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showApprovalWarning ? (
            <>
              <Button
                variant="default"
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={confirmApproval}
                disabled={approveMutation.isPending}
                data-testid="button-confirm-approval"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowApprovalWarning(false)}
                disabled={approveMutation.isPending}
                data-testid="button-cancel-approval"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                data-testid="button-approve-artwork"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Design
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRequestChanges}
                disabled={approveMutation.isPending}
                data-testid="button-request-changes"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Request Changes
              </Button>
            </>
          )}
        </div>

        {/* Existing Notes from Previous Feedback */}
        {quote.graphicsArtworkNotes && !showApprovalWarning && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Previous Feedback</div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {quote.graphicsArtworkNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
