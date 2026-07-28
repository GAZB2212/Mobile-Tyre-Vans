import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getImageUrl } from "@/lib/utils";

export type SetProgress = (msg: string | null) => void;

export interface UseFileUploadOptions {
  uploadFn: (file: File, setProgress: SetProgress) => Promise<string>;
  onSuccess?: (url: string) => void;
  successToast?: { title: string; description?: string };
  errorToast?: { title: string; description?: string };
}

export function useFileUpload({
  uploadFn,
  onSuccess,
  successToast,
  errorToast = { title: "Upload failed" },
}: UseFileUploadOptions) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFn(file, setProgress);
      onSuccess?.(url);
      if (successToast) {
        toast({ title: successToast.title, description: successToast.description });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast({
        title: errorToast.title,
        description: message ?? errorToast.description ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return { uploading, progress, inputRef, handleChange };
}

export async function uploadToObjectStorage(file: File, contentType?: string): Promise<string> {
  const resolvedContentType = contentType ?? file.type ?? "application/octet-stream";
  const res = await apiRequest("POST", "/api/objects/upload", {
    filename: file.name,
    contentType: resolvedContentType,
  });
  const { uploadURL, objectPath } = await res.json();
  await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": resolvedContentType },
  });
  return getImageUrl(objectPath);
}
