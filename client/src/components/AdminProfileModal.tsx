import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Camera, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

interface AdminProfileModalProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return user.username[0].toUpperCase();
}

export function AdminProfileModal({ user, open, onOpenChange }: AdminProfileModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Avatar updated", description: "Your profile picture has been saved." });
      setPreview(null);
      setSelectedFile(null);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentAvatarUrl = preview || user.profileImageUrl || undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Profile Picture</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          {/* Avatar preview */}
          <div className="relative group">
            <Avatar className="w-24 h-24 ring-2 ring-border">
              <AvatarImage src={currentAvatarUrl} alt={displayName} />
              <AvatarFallback className="text-2xl font-semibold bg-accent/15 text-accent">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid="button-change-avatar"
            >
              <Camera size={20} className="text-white" />
            </button>
          </div>

          <div className="text-center">
            <p className="font-medium">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          {/* File input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-avatar-file"
          />

          {!selectedFile ? (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              data-testid="button-select-avatar"
            >
              <Upload size={16} className="mr-2" />
              Choose Photo
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
                disabled={uploading}
                data-testid="button-cancel-avatar"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled={uploading}
                data-testid="button-save-avatar"
              >
                {uploading ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Save Photo"
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF · Max 5 MB</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
