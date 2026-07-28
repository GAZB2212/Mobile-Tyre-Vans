import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";
import { Loader2 } from "lucide-react";

type QrLabelData = {
  token: string;
  vanRegistration: string | null;
  userName: string;
  company: string | null;
  kitName: string | null;
};

export default function QrLabel() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery<QrLabelData>({
    queryKey: [`/api/admin/quotes/${id}/progress-token`],
    queryFn: () => fetchJson(`/api/admin/quotes/${id}/progress-token`),
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Could not load label data.
      </div>
    );
  }

  const progressUrl = `${window.location.origin}/workshop/${data.token}`;
  const reg = data.vanRegistration ?? "";
  const name = data.userName;
  const kit = data.kitName;

  return (
    <>
      <style>{`
        @page {
          size: 50mm 25mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          margin: 0;
          padding: 0;
          background: white;
        }
        .label {
          width: 50mm;
          height: 25mm;
          display: flex;
          align-items: stretch;
          font-family: Arial, sans-serif;
          background: white;
          overflow: hidden;
        }
        .qr-side {
          width: 25mm;
          height: 25mm;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5mm;
          flex-shrink: 0;
        }
        .qr-side svg {
          width: 22mm !important;
          height: 22mm !important;
        }
        .info-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 1.5mm 2mm 1.5mm 0;
          gap: 1mm;
          overflow: hidden;
          border-left: 0.3mm solid #ddd;
        }
        .brand {
          font-size: 4pt;
          color: #999;
          font-weight: 600;
          letter-spacing: 0.3mm;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .plate {
          font-size: 11pt;
          font-weight: 900;
          letter-spacing: 0.5mm;
          text-transform: uppercase;
          color: #000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1;
        }
        .customer-name {
          font-size: 6pt;
          font-weight: 600;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .kit-name {
          font-size: 5pt;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .scan-hint {
          font-size: 4pt;
          color: #aaa;
          margin-top: auto;
          white-space: nowrap;
        }
        @media screen {
          body {
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .label {
            box-shadow: 0 2px 16px rgba(0,0,0,0.18);
            border-radius: 2mm;
          }
          .preview-note {
            position: fixed;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.75);
            color: white;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-family: Arial, sans-serif;
          }
        }
        @media print {
          .preview-note { display: none; }
        }
      `}</style>

      <div className="label">
        <div className="qr-side">
          <QRCodeSVG
            value={progressUrl}
            size={78}
            level="M"
            includeMargin={false}
          />
        </div>
        <div className="info-side">
          <div className="brand">Mobile Tyre Vans</div>
          {reg && <div className="plate">{reg}</div>}
          <div className="customer-name">{name}</div>
          {kit && <div className="kit-name">{kit}</div>}
          <div className="scan-hint">Scan for build progress</div>
        </div>
      </div>

      <div className="preview-note">Print dialog opening&hellip;</div>
    </>
  );
}
