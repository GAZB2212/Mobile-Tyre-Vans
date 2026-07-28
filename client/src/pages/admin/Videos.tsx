import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Upload, CheckCircle, Video, Loader2 } from "lucide-react";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

const DEFAULT_VIDEOS = {
  hero_video_url: "/media/hero_vid_optimised.mp4",
  render_video_1_url: "/media/ZenoVideo 20_1759504716286.mp4",
  render_video_2_url: "/media/ZenoVideo 14_1759504750775.mp4",
  render_video_3_url: "/media/ZenoVideo 8_1759504750775.mp4",
};

const VIDEO_LABELS: Record<string, { title: string; description: string }> = {
  hero_video_url: {
    title: "Hero Video",
    description: "The full-width background video shown at the top of the homepage.",
  },
  render_video_1_url: {
    title: "Realistic Video of Van Artwork Render — Video 1 (Featured)",
    description: "First render video shown in the Van Design Gallery section (featured card).",
  },
  render_video_2_url: {
    title: "Realistic Video of Van Artwork Render — Video 2",
    description: "Second render video shown in the Van Design Gallery section.",
  },
  render_video_3_url: {
    title: "Realistic Video of Van Artwork Render — Video 3",
    description: "Third render video shown in the Van Design Gallery section.",
  },
};

function VideoUploadCard({
  settingKey,
  currentUrl,
  onUpdated,
}: {
  settingKey: string;
  currentUrl: string;
  onUpdated: () => void;
}) {
  const label = VIDEO_LABELS[settingKey] ?? { title: settingKey, description: "" };

  const updateSetting = useMutation({
    mutationFn: (url: string) =>
      apiRequest("PUT", `/api/admin/site-settings/${settingKey}`, { value: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      onUpdated();
    },
  });

  const { uploading, progress, inputRef: fileInputRef, handleChange: handleFileChange } = useFileUpload({
    uploadFn: async (file, setProgress) => {
      setProgress("Uploading to cloud storage…");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-video", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json();
      setProgress("Saving URL…");
      await updateSetting.mutateAsync(url);
      return url;
    },
    successToast: { title: "Video updated", description: `${label.title} has been saved.` },
    errorToast: { title: "Upload failed" },
  });

  return (
    <Card data-testid={`card-video-${settingKey}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap pb-3">
        <div>
          <CardTitle className="text-base">{label.title}</CardTitle>
          <CardDescription className="mt-1 text-sm">{label.description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {uploading ? (
            <Button size="sm" disabled data-testid={`button-uploading-${settingKey}`}>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              {progress ?? "Uploading…"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              data-testid={`button-upload-${settingKey}`}
            >
              <Upload className="w-3 h-3 mr-2" />
              Replace Video
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            className="hidden"
            onChange={handleFileChange}
            data-testid={`input-file-${settingKey}`}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="aspect-video bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
          {currentUrl ? (
            <video
              key={currentUrl}
              src={currentUrl}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Video className="w-8 h-8" />
              <span className="text-sm">No video set</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <span className="text-white text-sm">{progress}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 truncate" data-testid={`text-url-${settingKey}`}>
          {currentUrl || "No URL set"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminVideos() {
  const { data: settings = {}, refetch } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
  });

  const videoKeys = Object.keys(VIDEO_LABELS);

  return (
    <div className="min-h-screen bg-background">
      <AdminBackButton />
      <AdminPageHeader
        title="Manage Videos"
        description="Upload replacement videos — changes go live immediately on the deployed site."
      />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videoKeys.map((key) => (
            <VideoUploadCard
              key={key}
              settingKey={key}
              currentUrl={settings[key] ?? DEFAULT_VIDEOS[key as keyof typeof DEFAULT_VIDEOS] ?? ""}
              onUpdated={refetch}
            />
          ))}
        </div>

        <Card className="mt-6">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Videos are stored in cloud storage and served directly — no re-deployment needed after uploading. Recommended format: MP4 (H.264), optimised for web streaming. Maximum file size: 500 MB.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
