import { NextRequest, NextResponse } from "next/server";
import {
  addIceCandidate,
  getIceCandidates,
  getSdp,
  setSdp,
} from "@/lib/kv";

// This route is ONLY for exchanging tiny handshake messages (SDP offers/
// answers + ICE candidates) so the browser on the PC and the browser on
// the phone can find each other and open a direct WebRTC connection.
// No file data ever goes through here or through Vercel/KV.

type PostBody =
  | { roomId: string; kind: "sdp"; role: "offer" | "answer"; sdp: string }
  | {
      roomId: string;
      kind: "ice";
      role: "offer" | "answer";
      candidate: string;
    };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as PostBody;

  if (!body.roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  if (body.kind === "sdp") {
    await setSdp(body.roomId, body.role, body.sdp);
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "ice") {
    await addIceCandidate(body.roomId, body.role, body.candidate);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid kind" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  const kind = searchParams.get("kind"); // "sdp" | "ice"
  const role = searchParams.get("role") as "offer" | "answer" | null;

  if (!roomId || !kind || !role) {
    return NextResponse.json(
      { error: "roomId, kind, and role are required" },
      { status: 400 }
    );
  }

  if (kind === "sdp") {
    const sdp = await getSdp(roomId, role);
    return NextResponse.json({ sdp });
  }

  if (kind === "ice") {
    const candidates = await getIceCandidates(roomId, role);
    return NextResponse.json({ candidates });
  }

  return NextResponse.json({ error: "invalid kind" }, { status: 400 });
}
