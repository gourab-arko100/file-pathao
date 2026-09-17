import { Redis } from "@upstash/redis";

// Vercel's Redis (Upstash) marketplace integration injects KV_REST_API_URL
// and KV_REST_API_TOKEN into the project's env vars automatically once the
// store is connected — see README for how to set this up.
// automaticDeserialization is disabled so every value we store and read
// back is a plain string, exactly as we wrote it. Without this, the
// client tries to auto-JSON.parse anything that looks like JSON on
// read — which breaks values we've already JSON.stringify'd ourselves
// (like ICE candidates), since it silently turns them back into objects
// before our own JSON.parse() ever runs.
const kv = new Redis({
  url: process.env.KV_REST_API_URL as string,
  token: process.env.KV_REST_API_TOKEN as string,
  automaticDeserialization: false,
});

// A signaling "room" lives for a short window only — it's just used to
// hand PC and phone each other's WebRTC offer/answer + ICE candidates.
// Once the peer-to-peer connection is up, KV is no longer touched, and
// actual file bytes never pass through Vercel/KV at all.
const ROOM_TTL_SECONDS = 15 * 60; // 15 minutes

const metaKey = (roomId: string) => `fp:room:${roomId}:meta`;
const iceKey = (roomId: string, role: "offer" | "answer") =>
  `fp:room:${roomId}:ice:${role}`;

export async function setSdp(
  roomId: string,
  role: "offer" | "answer",
  sdp: string
) {
  await kv.hset(metaKey(roomId), { [role]: sdp });
  await kv.expire(metaKey(roomId), ROOM_TTL_SECONDS);
}

export async function getSdp(
  roomId: string,
  role: "offer" | "answer"
): Promise<string | null> {
  const value = await kv.hget<string>(metaKey(roomId), role);
  return value ?? null;
}

export async function addIceCandidate(
  roomId: string,
  role: "offer" | "answer",
  candidate: string
) {
  const key = iceKey(roomId, role);
  await kv.rpush(key, candidate);
  await kv.expire(key, ROOM_TTL_SECONDS);
}

export async function getIceCandidates(
  roomId: string,
  role: "offer" | "answer"
): Promise<string[]> {
  const key = iceKey(roomId, role);
  const items = await kv.lrange<string>(key, 0, -1);
  return items ?? [];
}
