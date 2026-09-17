"use client";

import { Fragment, useRef } from "react";
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

const STEPS = ["Waiting", "Connecting", "Connected"];

function statusStepIndex(status: ConnectionStatus): number {
  if (status === "idle" || status === "waiting-for-peer") return 0;
  if (status === "connecting") return 1;
  if (status === "connected") return 2;
  return -1; // failed / disconnected
}

function Stepper({ status }: { status: ConnectionStatus }) {
  if (status === "failed" || status === "disconnected") {
    return (
      <div className="stepper">
        <div className="step step--error">
          <span className="step-dot" />
          {status === "failed" ? "Connection failed" : "Disconnected"}
        </div>
      </div>
    );
  }

  const activeIdx = statusStepIndex(status);

  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          <div
            className={
              "step" +
              (i < activeIdx ? " step--done" : "") +
              (i === activeIdx ? " step--active" : "")
            }
          >
            <span className="step-dot" />
            {label}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={
                "step-connector" + (i < activeIdx ? " step-connector--done" : "")
              }
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

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
    <>
      <div className="tear-divider" />
      <Stepper status={status} />
      <div className="tear-divider" />

      <div className="transfer-section">
        {error && <div className="ft-error">{error}</div>}

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

        {outgoingTransfers.length > 0 && (
          <div className="manifest">
            <p className="manifest-heading">SENDING</p>
            {outgoingTransfers.map((t) => (
              <div className="manifest-row" key={t.id}>
                <div className="manifest-row-top">
                  <span className="manifest-name">{t.name}</span>
                </div>
                <div className="manifest-track">
                  <div
                    className="manifest-fill"
                    style={{ width: `${(t.sentBytes / t.size) * 100}%` }}
                  />
                </div>
                <div className="manifest-meta">
                  <span>
                    {formatBytes(t.sentBytes)} / {formatBytes(t.size)}
                  </span>
                  {t.done && <span className="done-tag">SENT</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {incomingFiles.length > 0 && (
          <div className="manifest">
            <p className="manifest-heading">RECEIVED</p>
            {incomingFiles.map((f) => (
              <div className="manifest-row" key={f.id}>
                <div className="manifest-row-top">
                  <span className="manifest-name">{f.name}</span>
                </div>
                <div className="manifest-track">
                  <div
                    className="manifest-fill"
                    style={{ width: `${(f.receivedBytes / f.size) * 100}%` }}
                  />
                </div>
                <div className="manifest-meta">
                  <span>
                    {formatBytes(f.receivedBytes)} / {formatBytes(f.size)}
                  </span>
                  {f.done && f.url ? (
                    <a
                      className="manifest-download"
                      href={f.url}
                      download={f.name}
                    >
                      Download
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
