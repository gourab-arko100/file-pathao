"use client";

import { useParams } from "next/navigation";
import FileTransfer from "@/components/FileTransfer";
import { useFileTransferPeer } from "@/hooks/useFileTransferPeer";

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  const { status, error, incomingFiles, outgoingTransfers, sendFile } =
    useFileTransferPeer(roomId, "client");

  return (
    <>
      <div className="header">
        <h1>File Pathao</h1>
        <p>Connecting to your PC…</p>
      </div>

      <div className="panel">
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
