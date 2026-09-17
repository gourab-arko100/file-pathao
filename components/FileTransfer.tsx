"use client";

import { useRef } from "react";
import {
  ConnectionStatus,
  IncomingFile,
  OutgoingTransfer,
} from "@/hooks/useFileTransferPeer";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Starting…",
  "waiting-for-peer": "Waiting for the other device to scan/join…",
  connecting: "Connecting…",
  connected: "Connected — ready to send files",
  disconnected: "Disconnected",
  failed: "Connection failed",
};

export default function FileTransfer({
  status,
  error,
  incomingFiles,
  outgoingTransfers,
  onSendFile,
}: {
  status: ConnectionStatus;
  error: string | null;
  incomingFiles: IncomingFile[];
  outgoingTransfers: OutgoingTransfer[];
  onSendFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="ft-wrap">
      <div className={`ft-status ft-status--${status}`}>
        <span className="ft-dot" />
        {STATUS_LABEL[status]}
      </div>
      {error && <div className="ft-error">{error}</div>}

      <div className="ft-send">
        <button
          className="ft-button"
          disabled={status !== "connected"}
          onClick={() => inputRef.current?.click()}
        >
          Choose file to send
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSendFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {outgoingTransfers.length > 0 && (
        <div className="ft-list">
          <h3>Sending</h3>
          {outgoingTransfers.map((t) => (
            <div className="ft-item" key={t.id}>
              <div className="ft-item-name">{t.name}</div>
              <div className="ft-progress">
                <div
                  className="ft-progress-bar"
                  style={{ width: `${(t.sentBytes / t.size) * 100}%` }}
                />
              </div>
              <div className="ft-item-meta">
                {formatBytes(t.sentBytes)} / {formatBytes(t.size)}
                {t.done ? " · done" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {incomingFiles.length > 0 && (
        <div className="ft-list">
          <h3>Received</h3>
          {incomingFiles.map((f) => (
            <div className="ft-item" key={f.id}>
              <div className="ft-item-name">{f.name}</div>
              <div className="ft-progress">
                <div
                  className="ft-progress-bar"
                  style={{ width: `${(f.receivedBytes / f.size) * 100}%` }}
                />
              </div>
              <div className="ft-item-meta">
                {formatBytes(f.receivedBytes)} / {formatBytes(f.size)}
                {f.done && f.url ? (
                  <a className="ft-download" href={f.url} download={f.name}>
                    Download
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
