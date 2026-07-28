import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Badge } from "@/components/ui/badge";
import { Play, Film, VideoOff } from "lucide-react";

interface GalleryVideoCardProps {
  fileUrl: string;
  title: string;
  storedThumbnailUrl?: string | null;
}

export function GalleryVideoCard({ fileUrl, title, storedThumbnailUrl }: GalleryVideoCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState(false);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isModalOpen) {
      setModalError(false);
      const timer = setTimeout(() => {
        if (modalVideoRef.current) modalVideoRef.current.play().catch(() => {});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  const isMov = fileUrl.toLowerCase().endsWith('.mov');

  return (
    <>
      <div
        className="w-full h-full relative group cursor-pointer"
        onClick={() => setIsModalOpen(true)}
        data-testid="button-play-video"
      >
        {storedThumbnailUrl ? (
          <img
            src={storedThumbnailUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <Film className="w-12 h-12 text-neutral-600" />
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 group-hover:bg-black/40 transition-colors">
          <div className="w-14 h-14 rounded-full bg-accent/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
            <Play className="w-7 h-7 text-accent-foreground ml-0.5" />
          </div>
          <Badge variant="secondary" className="text-xs pointer-events-none">Video</Badge>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-3 bg-black border-border">
          <VisuallyHidden><DialogTitle>{title}</DialogTitle></VisuallyHidden>
          {modalError ? (
            <div className="w-full flex flex-col items-center justify-center gap-4 py-12 text-white">
              <VideoOff className="w-12 h-12 text-white/50" />
              <p className="text-sm text-white/70 text-center max-w-sm">
                This video format may not be supported in your browser.
                {isMov && (
                  <> Try opening in Safari, or ask the site admin to upload an MP4 version.</>
                )}
              </p>
              <a
                href={fileUrl}
                download
                className="text-accent text-sm underline"
              >
                Download video
              </a>
            </div>
          ) : (
            <video
              ref={modalVideoRef}
              src={fileUrl}
              controls
              playsInline
              className="w-full rounded"
              style={{ maxHeight: "80vh" }}
              data-testid="video-player-modal"
              onError={() => setModalError(true)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
