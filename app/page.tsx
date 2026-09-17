"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import FileTransfer from "@/components/FileTransfer";
import { useFileTransferPeer } from "@/hooks/useFileTransferPeer";

export default function HomePage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string>("");

  useEffect(() => {
    const id = uuidv4();
    setRoomId(id);
    setRoomUrl(`${window.location.origin}/room/${id}`);
  }, []);

  const { status, error, incomingFiles, outgoingTransfers, sendFile } =
    useFileTransferPeer(roomId, "host");

  return (
    <>
      <div className="header">
        <div className="header-mark">
          <h1>File Pathao</h1>
          <p>Scan to connect your phone — no cables, no Bluetooth, nothing to install.</p>
        </div>
        <span className="header-tag">P2P TRANSFER</span>
      </div>

      <div className="panel">
        {roomUrl && roomId ? (
          <QRCodeDisplay url={roomUrl} roomId={roomId} />
        ) : null}
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
