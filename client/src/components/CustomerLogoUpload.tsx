import { useRef } from "react";
import { ObjectUploader } from "./ObjectUploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import type { UploadResult } from "@uppy/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Quote } from "@shared/schema";
import { Button } from "./ui/button";

interface CustomerLogoUploadProps {
  quote: Quote;
}

export default function CustomerLogoUpload({ quote }: CustomerLogoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pendingObjectPathRef = useRef<string | null>(null);

  const handleGetUploadParameters = async (file: { name: string; type: string }) => {
    const response = await apiRequest("POST", "/api/objects/upload", {
      filename: file.name,
      contentType: file.type,
    });
    
    const data = response as { uploadURL: string; objectPath: string };
    
    // Store the objectPath for use after upload completes
    pendingObjectPathRef.current = data.objectPath;
    
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      objectPath: data.objectPath,
    };
  };

  const uploadLogoMutation = useMutation({
    mutationFn: async (objectPath: string) => {
      return apiRequest("PUT", `/api/quotes/${quote.id}/logos`, {
        objectPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/portal/quotes/${quote.id}`] });
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to upload logo";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async (objectPath: string) => {
      return apiRequest("DELETE", `/api/quotes/${quote.id}/logos`, {
        objectPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/portal/quotes/${quote.id}`] });
      toast({
        title: "Success",
        description: "Logo removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    },
  });

  const handleComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0 && pendingObjectPathRef.current) {
      uploadLogoMutation.mutate(pendingObjectPathRef.current);
      pendingObjectPathRef.current = null;
    }
  };

  const customerLogos = quote.customerLogoUrls || [];
  const canUploadMore = customerLogos.length < 5;

  return (
    <Card data-testid="card-customer-logos">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Your Logos & Graphics
        </CardTitle>
        <CardDescription>
          Upload your company logos or graphics for the van wrapping design
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customerLogos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {customerLogos.map((objectPath, index) => (
                <div key={index} className="relative group" data-testid={`logo-preview-${index}`}>
                  <div className="aspect-square bg-card border rounded-md overflow-hidden">
                    <img 
                      src={objectPath} 
                      alt={`Customer logo ${index + 1}`}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => deleteLogoMutation.mutate(objectPath)}
                    disabled={deleteLogoMutation.isPending}
                    data-testid={`button-delete-logo-${index}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {canUploadMore ? (
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={10485760}
              allowedFileTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']}
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleComplete}
              buttonClassName="w-full"
            >
              <div className="flex items-center justify-center gap-2" data-testid="button-upload-logo">
                <Upload className="w-4 h-4" />
                <span>Upload Logo ({customerLogos.length}/5)</span>
              </div>
            </ObjectUploader>
          ) : (
            <div className="text-center p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Maximum of 5 logos reached
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Supported formats: PNG, JPG, SVG. Max file size: 10MB. Maximum 5 logos per quote.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
