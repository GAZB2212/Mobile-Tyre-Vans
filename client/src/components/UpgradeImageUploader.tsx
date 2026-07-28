import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, ImageIcon } from "lucide-react";
import { getImageUrl } from "@/lib/utils";
import imageCompression from "browser-image-compression";

interface UpgradeImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  maxFileSize?: number;
  uploaderId?: string;
}

export function UpgradeImageUploader({
  images,
  onChange,
  maxImages = 5,
  maxFileSize = 10485760, // 10MB
  uploaderId = "upgrade-image-upload",
}: UpgradeImageUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Compress image before upload for faster loading
      const options = {
        maxSizeMB: 1, // Maximum file size in MB
        maxWidthOrHeight: 1920, // Maximum width or height
        useWebWorker: true, // Use web worker for better performance
        fileType: file.type, // Preserve original file type
      };
      
      const compressedFile = await imageCompression(file, options);
      console.log(`📊 Original size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      
      // Use backend proxy upload - no CORS issues!
      const formData = new FormData();
      formData.append("file", compressedFile);

      const response = await fetch("/api/upgrades/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload file");
      }

      const data = await response.json();
      return data.publicURL;
    },
    onSuccess: (objectPath) => {
      console.log('✅ Image uploaded successfully, path:', objectPath);
      onChange([...images, objectPath]);
      toast({
        title: "Success",
        description: "Image uploaded successfully",
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

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum images reached",
        description: `You can only upload up to ${maxImages} images`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds ${maxFileSize / 1024 / 1024}MB limit`,
          variant: "destructive",
        });
        continue;
      }

      setUploading(true);
      try {
        await uploadMutation.mutateAsync(file);
      } catch (error) {
        // Error already handled in mutation's onError
        console.error("Upload failed:", error);
      } finally {
        setUploading(false);
      }
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

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
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
            Drag and drop images here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            PNG, JPG, GIF up to {maxFileSize / 1024 / 1024}MB (max {maxImages}{" "}
            images)
          </p>
          <input
            type="file"
            id={uploaderId}
            multiple
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={uploading || images.length >= maxImages}
            data-testid="input-upgrade-images"
          />
          <label htmlFor={uploaderId}>
            <Button
              type="button"
              variant="outline"
              disabled={uploading || images.length >= maxImages}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(uploaderId)?.click();
              }}
              data-testid="button-upload-images"
            >
              {uploading ? "Uploading..." : "Select Images"}
            </Button>
          </label>
        </div>
      </Card>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((imagePath, index) => (
            <Card key={index} className="relative group overflow-hidden">
              <div className="aspect-square relative">
                <img
                  src={getImageUrl(imagePath)}
                  alt={`Upgrade image ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  data-testid={`img-upgrade-preview-${index}`}
                  onError={(e) => {
                    console.error('❌ Failed to load upgrade image!');
                    console.error('Original path:', imagePath);
                    console.error('Transformed URL:', getImageUrl(imagePath));
                    console.error('Actual src:', e.currentTarget.src);
                  }}
                  onLoad={() => {
                    console.log('✅ Successfully loaded upgrade image:', imagePath);
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemove(index)}
                    data-testid={`button-remove-image-${index}`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No images uploaded yet</p>
        </div>
      )}

      {/* Counter */}
      <p className="text-xs text-muted-foreground text-center">
        {images.length} / {maxImages} images uploaded
      </p>
    </div>
  );
}
