"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QRCodeDisplay({
  url,
  roomId,
}: {
  url: string;
  roomId: string;
}) {
  const trackingCode = roomId.split("-")[0].toUpperCase();

  return (
    <div className="qr-section">
      <div className="qr-label">
        <span className="qr-label-corner">SCAN</span>
        <QRCodeSVG
          value={url}
          size={196}
          bgColor="#e9dfc6"
          fgColor="#2b2416"
        />
      </div>
      <div className="qr-code-id">
        ROOM <span>{trackingCode}</span>
      </div>
    </div>
  );
}
