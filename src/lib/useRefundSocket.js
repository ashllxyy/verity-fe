"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/refund";

// One full-duplex socket: frames go up, feedback/challenges come down.
// Server -> client messages: feedback {kind, message}, challenge {code, ttl}, challenge_clear
export function useRefundSocket() {
  const wsRef = useRef(null);
  const [status, setStatus] = useState("connecting"); // connecting | open | closed | error
  const [feedback, setFeedback] = useState({
    kind: "info",
    message: "Connecting…",
  });
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "feedback")
        setFeedback({ kind: m.kind, message: m.message });
      else if (m.type === "challenge")
        setChallenge({ code: m.code, ttl: m.ttl, receivedAt: Date.now() });
      else if (m.type === "challenge_clear") setChallenge(null);
    };
    return () => ws.close();
  }, []);

  const sendFrame = useCallback((image) => {
    const ws = wsRef.current;
    // Skip the frame if the socket is busy: stale frames are worse than dropped ones.
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      ws.bufferedAmount > 256 * 1024
    )
      return;
    ws.send(JSON.stringify({ type: "frame", ts: Date.now(), image }));
  }, []);

  return { status, feedback, challenge, sendFrame };
}
