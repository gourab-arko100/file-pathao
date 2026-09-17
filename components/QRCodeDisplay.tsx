"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QRCodeDisplay({ url }: { url: string }) {
  return (
    <div className="qr-wrap">
      <div className="qr-box">
        <QRCodeSVG value={url} size={220} includeMargin />
      </div>
      <p className="qr-url">{url}</p>
    </div>
  );
}
