"use client";

import { useParams } from "next/navigation";
import FileTransfer from "@/components/FileTransfer";
import { useFileTransferPeer } from "@/hooks/useFileTransferPeer";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  const { status, error, incomingFiles, outgoingTransfers, sendFile } =
    useFileTransferPeer(roomId, "client");

  const trackingCode = roomId.split("-")[0].toUpperCase();

  return (
    <>
      <div className="header">
        <div className="header-mark">
          <h1>File Pathao</h1>
          <p>Finding the other device…</p>
        </div>
        <span className="header-tag">P2P TRANSFER</span>
      </div>

      <div className="panel">
        <div className="qr-section">
          <div className="qr-code-id">
            ROOM <span>{trackingCode}</span>
          </div>
        </div>
        <FileTransfer
          status={status}
          error={error}
          incomingFiles={incomingFiles}
          outgoingTransfers={outgoingTransfers}
          onSendFile={sendFile}
        />
      </div>
    </>
  );
}
