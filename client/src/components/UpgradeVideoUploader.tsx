import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Video as VideoIcon, Play } from "lucide-react";
import { getImageUrl } from "@/lib/utils";

interface UpgradeVideoUploaderProps {
  videoUrl: string | null;
  onChange: (videoUrl: string | null) => void;
  maxFileSize?: number;
}

export function UpgradeVideoUploader({
  videoUrl,
  onChange,
  maxFileSize = 104857600, // 100MB for videos
}: UpgradeVideoUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Get presigned upload URL
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await response.json();

      // Upload file directly to cloud storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload video");
      }

      return objectPath;
    },
    onSuccess: (objectPath) => {
      console.log('✅ Video uploaded successfully, path:', objectPath);
      onChange(objectPath);
      toast({
        title: "Success",
        description: "Video uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, WebM, OGG, or MOV)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      toast({
        title: "File too large",
        description: `Video exceeds ${maxFileSize / 1024 / 1024}MB limit`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!videoUrl ? (
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-6 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drag and drop a video here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              MP4, WebM, OGG, MOV up to {maxFileSize / 1024 / 1024}MB
            </p>
            <input
              type="file"
              id="upgrade-video-upload"
              accept="video/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              disabled={uploading}
              data-testid="input-upgrade-video"
            />
            <label htmlFor="upgrade-video-upload">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("upgrade-video-upload")?.click();
                }}
                data-testid="button-upload-video"
              >
                {uploading ? "Uploading..." : "Select Video"}
              </Button>
            </label>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <video
              src={getImageUrl(videoUrl)}
              controls
              preload="metadata"
              className="w-full h-full"
              data-testid="video-upgrade-preview"
            >
              <source src={getImageUrl(videoUrl)} type="video/mp4" />
              <source src={getImageUrl(videoUrl)} type="video/webm" />
              <source src={getImageUrl(videoUrl)} type="video/ogg" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute top-2 right-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                data-testid="button-remove-video"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!videoUrl && !uploading && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <VideoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No video uploaded yet</p>
        </div>
      )}
    </div>
  );
}
