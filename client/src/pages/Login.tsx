import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { setDisplayName } from "../hooks/useAuth";
import { SoftAurora } from "../components/ui/SoftAurora";

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string;

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setLoading(true);

    try {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const { data, error: authErr } =
          await supabase.auth.signInAnonymously();
        if (authErr) throw authErr;
        session = data.session;
      }
      console.log('Final session user ID:', session?.user?.id)


      const displayName = name.trim();
      setDisplayName(displayName);

      if (!session) throw new Error("No session");

      if (mode === "join" && roomCode.trim()) {
        navigate(`/room/${roomCode.trim()}`);
        return;
      }

      const res = await fetch(`${SERVER_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: `${displayName}'s War Room` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create room");
      navigate(`/room/${json.room.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0E0C0A",
      }}
    >
      {/* WebGL Aurora */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <SoftAurora
          color1="#5D5646"
          color2="#3E5974"
          speed={0.2}
          brightness={0.6}
          noiseFrequency={0.8}
          noiseAmplitude={0.7}
          bandHeight={0.5}
          bandSpread={0.4}
          enableMouseInteraction
          mouseInfluence={0.5}
        />
      </div>

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(ellipse at center, rgba(14,12,10,0.2) 0%, rgba(14,12,10,0.7) 100%)",
        }}
      />

      {/* Layout */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "24px",
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "56px" }}
        >
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "72px",
              fontWeight: 800,
              letterSpacing: "-3px",
              color: "#E8E0D0",
              lineHeight: 1,
              marginBottom: "14px",
              textShadow: "0 0 80px rgba(184,134,11,0.15)",
            }}
          >
            LIGMA
          </div>
          <div
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: "11px",
              letterSpacing: "4px",
              color: "#8B8680",
              textTransform: "uppercase",
            }}
          >
            Live Interactive Group Meeting Assistant
          </div>
        </motion.div>

        {/* Gate Card */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "rgba(20, 17, 14, 0.75)",
            backdropFilter: "contrast(110%) blur(24px)",
            WebkitBackdropFilter: "contrast(110%) blur(24px)",
            border: "1px solid rgba(200, 188, 168, 0.12)",
            borderRadius: "18px",
            padding: "36px",
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top shimmer line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, rgba(184,134,11,0.5), transparent)",
              backgroundSize: "200% auto",
              animation: "shimmer 3s linear infinite",
            }}
          />

          {/* Mode switcher */}
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "999px",
              padding: "3px",
              marginBottom: "32px",
              border: "1px solid rgba(200, 188, 168, 0.08)",
            }}
          >
            {(["create", "join"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "DM Mono, monospace",
                  fontSize: "11px",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  transition: "all 0.25s",
                  background:
                    mode === m
                      ? "linear-gradient(135deg, rgba(93,86,70,0.9), rgba(62,89,116,0.7))"
                      : "transparent",
                  color: mode === m ? "#E8E0D0" : "#8B8680",
                  boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                }}
              >
                {m === "create" ? "New Room" : "Join Room"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEnter}>
            {/* Display Name */}
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "DM Mono, monospace",
                  fontSize: "10px",
                  letterSpacing: "2px",
                  color: "#8B8680",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Operative Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Enter your name..."
                maxLength={32}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(232, 224, 208, 0.05)",
                  border: "1px solid rgba(200, 188, 168, 0.12)",
                  borderRadius: "10px",
                  color: "#E8E0D0",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "15px",
                  fontWeight: 300,
                  outline: "none",
                  caretColor: "#B8860B",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(184, 134, 11, 0.4)";
                  e.target.style.boxShadow = "0 0 0 2px rgba(184,134,11,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(200, 188, 168, 0.12)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Room Code (join mode) */}
            <AnimatePresence>
              {mode === "join" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: "18px", overflow: "hidden" }}
                >
                  <label
                    style={{
                      display: "block",
                      fontFamily: "DM Mono, monospace",
                      fontSize: "10px",
                      letterSpacing: "2px",
                      color: "#8B8680",
                      textTransform: "uppercase",
                      marginBottom: "10px",
                    }}
                  >
                    Room ID
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="Paste room ID..."
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "rgba(232, 224, 208, 0.05)",
                      border: "1px solid rgba(200, 188, 168, 0.12)",
                      borderRadius: "10px",
                      color: "#E8E0D0",
                      fontFamily: "DM Mono, monospace",
                      fontSize: "13px",
                      outline: "none",
                      caretColor: "#B8860B",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: "11px",
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    marginBottom: "16px",
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Enter button */}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                position: "relative",
                width: "100%",
                padding: "14px 0",
                background:
                  loading || !name.trim()
                    ? "rgba(93,86,70,0.3)"
                    : "linear-gradient(135deg, #5D5646 0%, #3E5974 100%)",
                border: "1px solid rgba(200, 188, 168, 0.15)",
                borderRadius: "999px",
                color: "#E8E0D0",
                fontFamily: "Syne, sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "1px",
                cursor: loading || !name.trim() ? "not-allowed" : "pointer",
                overflow: "hidden",
                transition: "opacity 0.2s, transform 0.15s",
                transform: "scale(1)",
                opacity: loading || !name.trim() ? 0.5 : 1,
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>
                {loading
                  ? "Accessing..."
                  : mode === "create"
                    ? "Open War Room →"
                    : "Breach Entry →"}
              </span>
              {!loading && name.trim() && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, rgba(212,160,23,0.25), transparent)",
                    backgroundSize: "200% auto",
                    animation: "shimmer 2s linear infinite",
                  }}
                />
              )}
            </button>
          </form>

          {/* System status */}
          <div
            style={{
              marginTop: "24px",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(200,188,168,0.06)",
              borderRadius: "8px",
              fontFamily: "DM Mono, monospace",
              fontSize: "9px",
              letterSpacing: "1.5px",
              color: "#8B8680",
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            SYSTEM STATUS: ANONYMOUS ACCESS ENABLED
            <br />
            <span style={{ color: "#5B7A9E" }}>
              // ENCRYPTED SESSION · NO CREDENTIALS STORED
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
