"use client";
import { useEffect, useRef, useState } from "react";
import { useRefundSocket } from "../lib/useRefundSocket";

function Intro({ onStart }) {
  return (
    <main className="intro">
      <h1>Show us the damage, get your refund.</h1>
      <p className="lede">
        Your seller asked us to check this claim. You will show the item to your
        camera and follow a few live instructions. It takes about two minutes.
      </p>
      <ul className="expect">
        <li>
          We may ask you to write a short code on paper and hold it next to the
          item.
        </li>
        <li>
          Camera frames are shared with the seller so they can review your
          claim.
        </li>
        <li>
          Small claims can be refunded straight away. Larger ones go to the
          seller for review.
        </li>
      </ul>
      <button className="primary" onClick={onStart}>
        Start refund
      </button>
    </main>
  );
}

function Capture({ onExit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [camError, setCamError] = useState(null);
  const [left, setLeft] = useState(null);
  const { status, feedback, challenge, sendFrame } = useRefundSocket();

  // Camera
  useEffect(() => {
    let stream;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() =>
        setCamError(
          "Camera access was blocked. Allow camera access in your browser and try again.",
        ),
      );
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Send ~1 small JPEG per second (cheap to transmit, cheap to analyse)
  useEffect(() => {
    if (status !== "open") return;
    const id = setInterval(() => {
      const v = videoRef.current,
        c = canvasRef.current;
      if (!v || !c || !v.videoWidth) return;
      const w = 640,
        h = Math.round((v.videoHeight / v.videoWidth) * w);
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(v, 0, 0, w, h);
      sendFrame(c.toDataURL("image/jpeg", 0.6));
    }, 1000);
    return () => clearInterval(id);
  }, [status, sendFrame]);

  // Challenge countdown
  useEffect(() => {
    if (!challenge) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(
        Math.max(
          0,
          Math.ceil(challenge.ttl - (Date.now() - challenge.receivedAt) / 1000),
        ),
      );
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [challenge]);

  const connLabel = {
    connecting: "Connecting",
    open: "Live",
    closed: "Disconnected",
    error: "Connection failed",
  }[status];
  const dead = status === "closed" || status === "error";
  const message =
    camError ||
    (dead
      ? "Lost connection to the verifier. Cancel and start again."
      : feedback.message);
  const kind = camError || dead ? "error" : feedback.kind;

  return (
    <main className="stage">
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} hidden />
      <span className="bracket tl" />
      <span className="bracket tr" />
      <span className="bracket bl" />
      <span className="bracket br" />

      <header className="topbar">
        <span className={"conn " + status}>{connLabel}</span>
        <button className="ghost" onClick={onExit}>
          Cancel
        </button>
      </header>

      <section className="dock">
        {challenge && (
          <div className="slip" role="group" aria-label="Verification code">
            <span className="hole" />
            <p>Write this on paper and hold it next to the item</p>
            <strong>{challenge.code}</strong>
            <small>{left}s left</small>
          </div>
        )}
        <div className={"feedback " + kind} role="status" aria-live="polite">
          {message}
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  const [started, setStarted] = useState(false);
  return started ? (
    <Capture onExit={() => setStarted(false)} />
  ) : (
    <Intro onStart={() => setStarted(true)} />
  );
}
