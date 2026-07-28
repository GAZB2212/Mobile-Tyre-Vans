import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Camera, X } from "lucide-react";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (sku: string) => void;
  title?: string;
  description?: string;
  expectedSku?: string;
}

export function QrScannerModal({ open, onClose, onScan, title = "Scan QR Code", description, expectedSku }: QrScannerModalProps) {
  const resolvedDescription = description ?? (expectedSku
    ? `Scan the QR label for part ${expectedSku} to deduct 1 unit.`
    : "Point the camera at a component QR label to deduct stock.");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setScanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Camera access denied. Please allow camera access in your browser settings.");
    }
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code?.data) {
      stopCamera();
      onScan(code.data.trim());
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [onScan, stopCamera]);

  useEffect(() => {
    if (scanning && videoRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, tick]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setError(null);
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopCamera(); onClose(); } }}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" onClick={startCamera}>Try again</Button>
            </div>
          ) : (
            <div className="relative rounded-md overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                data-testid="video-qr-scanner"
              />
              {/* Targeting crosshair overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                  <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                  <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                  <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { stopCamera(); onClose(); }} data-testid="button-scanner-cancel">
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
