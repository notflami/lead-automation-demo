"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** The entrance QR code: encodes the guest's personal ticket link (opens the ticket page when scanned with a phone camera). */
export function TicketQr({ path, label, className = "" }: { path: string; label: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const url = window.location.origin + path;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#141a33", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <div
      role="img"
      aria-label={label}
      className={`aspect-square w-full max-w-64 rounded-xl bg-white p-2 shadow-sm ring-1 ring-ink/10 [&>svg]:block [&>svg]:size-full ${className}`}
      // Generated locally from the ticket link; contains only SVG paths.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
