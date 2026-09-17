"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHUNK_SIZE = 16 * 1024; // 16KB — safe max message size across browsers
const POLL_INTERVAL_MS = 1500;
const BUFFERED_AMOUNT_THRESHOLD = 8 * 1024 * 1024; // pause sending above 8MB queued

export type ConnectionStatus =
  | "idle"
  | "waiting-for-peer"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface IncomingFile {
  id: string;
  name: string;
  size: number;
  type: string;
  receivedBytes: number;
  url?: string;
  done: boolean;
}

export interface OutgoingTransfer {
  id: string;
  name: string;
  size: number;
  sentBytes: number;
  done: boolean;
}

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }
  return servers;
}

async function postSignal(body: Record<string, unknown>) {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getSignal(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/signal?${qs}`);
  return res.json();
}

export function useFileTransferPeer(
  roomId: string | null,
  role: "host" | "client"
) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [incomingFiles, setIncomingFiles] = useState<
    Record<string, IncomingFile>
  >({});
  const [outgoing, setOutgoing] = useState<Record<string, OutgoingTransfer>>(
    {}
  );

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollersRef = useRef<number[]>([]);
  const startedRef = useRef(false);
  const currentIncomingIdRef = useRef<string | null>(null);
  const incomingBuffersRef = useRef<
    Record<string, { chunks: ArrayBuffer[]; size: number }>
  >({});

  const clearPollers = useCallback(() => {
    pollersRef.current.forEach((id) => window.clearInterval(id));
    pollersRef.current = [];
  }, []);

  useEffect(() => {
    if (status === "connected") clearPollers();
  }, [status, clearPollers]);

  useEffect(() => {
    return () => {
      clearPollers();
      dcRef.current?.close();
      pcRef.current?.close();
    };
  }, [clearPollers]);

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.binaryType = "arraybuffer";
    dcRef.current = dc;

    dc.onopen = () => setStatus("connected");
    dc.onclose = () => setStatus("disconnected");
    dc.onerror = () => setError("Data channel error");

    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        if (msg.type === "meta") {
          currentIncomingIdRef.current = msg.id;
          incomingBuffersRef.current[msg.id] = { chunks: [], size: 0 };
          setIncomingFiles((prev) => ({
            ...prev,
            [msg.id]: {
              id: msg.id,
              name: msg.name,
              size: msg.size,
              type: msg.mime || "application/octet-stream",
              receivedBytes: 0,
              done: false,
            },
          }));
        } else if (msg.type === "done") {
          const buf = incomingBuffersRef.current[msg.id];
          if (buf) {
            const meta = incomingFilesSnapshot(msg.id);
            const blob = new Blob(buf.chunks, {
              type: meta?.type || "application/octet-stream",
            });
            const url = URL.createObjectURL(blob);
            setIncomingFiles((prev) => ({
              ...prev,
              [msg.id]: {
                ...prev[msg.id],
                receivedBytes: buf.size,
                url,
                done: true,
              },
            }));
            delete incomingBuffersRef.current[msg.id];
          }
          currentIncomingIdRef.current = null;
        }
      } else {
        const id = currentIncomingIdRef.current;
        if (!id) return;
        const buf = incomingBuffersRef.current[id];
        if (!buf) return;
        const chunk = event.data as ArrayBuffer;
        buf.chunks.push(chunk);
        buf.size += chunk.byteLength;
        setIncomingFiles((prev) =>
          prev[id]
            ? { ...prev, [id]: { ...prev[id], receivedBytes: buf.size } }
            : prev
        );
      }
    };

    // helper to read latest incoming file meta without a stale closure
    function incomingFilesSnapshot(id: string) {
      let result: IncomingFile | undefined;
      setIncomingFiles((prev) => {
        result = prev[id];
        return prev;
      });
      return result;
    }
  }, []);

  const startAsHost = useCallback(async () => {
    if (!roomId) return;
    setStatus("waiting-for-peer");
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;

    const dc = pc.createDataChannel("file-transfer");
    setupDataChannel(dc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        postSignal({
          roomId,
          kind: "ice",
          role: "offer",
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setStatus("failed");
      if (pc.connectionState === "disconnected") setStatus("disconnected");
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postSignal({
      roomId,
      kind: "sdp",
      role: "offer",
      sdp: offer.sdp,
    });

    const pollAnswer = window.setInterval(async () => {
      const data = await getSignal({ roomId, kind: "sdp", role: "answer" });
      if (data.sdp && pc.signalingState === "have-local-offer") {
        setStatus("connecting");
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        window.clearInterval(pollAnswer);
      }
    }, POLL_INTERVAL_MS);
    pollersRef.current.push(pollAnswer);

    let iceSeen = 0;
    const pollIce = window.setInterval(async () => {
      const data = await getSignal({ roomId, kind: "ice", role: "answer" });
      const candidates: string[] = data.candidates || [];
      while (iceSeen < candidates.length) {
        try {
          await pc.addIceCandidate(JSON.parse(candidates[iceSeen]));
          iceSeen++;
        } catch {
          // remote description likely isn't set yet — stop here and
          // retry this same candidate on the next poll instead of
          // silently dropping it.
          break;
        }
      }
    }, POLL_INTERVAL_MS);
    pollersRef.current.push(pollIce);
  }, [roomId, setupDataChannel]);

  const startAsClient = useCallback(async () => {
    if (!roomId) return;
    setStatus("connecting");
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;

    pc.ondatachannel = (event) => setupDataChannel(event.channel);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        postSignal({
          roomId,
          kind: "ice",
          role: "answer",
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setStatus("failed");
      if (pc.connectionState === "disconnected") setStatus("disconnected");
    };

    let offerSdp: string | null = null;
    while (!offerSdp) {
      const data = await getSignal({ roomId, kind: "sdp", role: "offer" });
      if (data.sdp) {
        offerSdp = data.sdp as string;
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    await pc.setRemoteDescription({ type: "offer", sdp: offerSdp as string });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await postSignal({
      roomId,
      kind: "sdp",
      role: "answer",
      sdp: answer.sdp,
    });

    let iceSeen = 0;
    const pollIce = window.setInterval(async () => {
      const data = await getSignal({ roomId, kind: "ice", role: "offer" });
      const candidates: string[] = data.candidates || [];
      while (iceSeen < candidates.length) {
        try {
          await pc.addIceCandidate(JSON.parse(candidates[iceSeen]));
          iceSeen++;
        } catch {
          break;
        }
      }
      iceSeen = candidates.length;
    }, POLL_INTERVAL_MS);
    pollersRef.current.push(pollIce);
  }, [roomId, setupDataChannel]);

  useEffect(() => {
    if (!roomId || startedRef.current) return;
    startedRef.current = true;
    if (role === "host") startAsHost();
    else startAsClient();
  }, [roomId, role, startAsHost, startAsClient]);

  const sendFile = useCallback(async (file: File) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      setError("Not connected to the other device yet.");
      return;
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setOutgoing((prev) => ({
      ...prev,
      [id]: { id, name: file.name, size: file.size, sentBytes: 0, done: false },
    }));

    dc.send(
      JSON.stringify({
        type: "meta",
        id,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      })
    );

    let offset = 0;
    while (offset < file.size) {
      if (dc.bufferedAmount > BUFFERED_AMOUNT_THRESHOLD) {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (!dcRef.current || dcRef.current.bufferedAmount <= BUFFERED_AMOUNT_THRESHOLD) {
              resolve();
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        });
      }
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      dc.send(buffer);
      offset += buffer.byteLength;
      setOutgoing((prev) => ({
        ...prev,
        [id]: { ...prev[id], sentBytes: offset },
      }));
    }

    dc.send(JSON.stringify({ type: "done", id }));
    setOutgoing((prev) => ({
      ...prev,
      [id]: { ...prev[id], sentBytes: file.size, done: true },
    }));
  }, []);

  return {
    status,
    error,
    incomingFiles: Object.values(incomingFiles).sort((a, b) =>
      a.id < b.id ? 1 : -1
    ),
    outgoingTransfers: Object.values(outgoing).sort((a, b) =>
      a.id < b.id ? 1 : -1
    ),
    sendFile,
  };
}
