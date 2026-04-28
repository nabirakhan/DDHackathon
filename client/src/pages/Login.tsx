// client/src/pages/Login.tsx
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
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <SoftAurora
          color1="#5D5646"
          color2="#3E5974"
          speed={0.18}
          brightness={0.55}
          noiseFrequency={0.7}
          noiseAmplitude={0.65}
          bandHeight={0.45}
          bandSpread={0.38}
          enableMouseInteraction
          mouseInfluence={0.45}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(ellipse at center, rgba(14,12,10,0.1) 0%, rgba(14,12,10,0.72) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(14,12,10,0.03) 2px, rgba(14,12,10,0.03) 4px)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "24px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -28, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "52px" }}
        >
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "76px",
              fontWeight: 800,
              letterSpacing: "-4px",
              color: "#EEEAE2",
              lineHeight: 1,
              marginBottom: "14px",
              textShadow:
                "0 0 80px rgba(160,125,84,0.18), 0 2px 0 rgba(0,0,0,0.5)",
            }}
          >
            LIGMA
          </div>
          <div
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: "10px",
              letterSpacing: "5px",
              color: "#8B8680",
              textTransform: "uppercase",
            }}
          >
            Live Interactive Group Meeting Assistant
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.96, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%",
            maxWidth: "400px",
            background: "rgba(26, 28, 30, 0.72)",
            backdropFilter: "contrast(112%) blur(28px)",
            WebkitBackdropFilter: "contrast(112%) blur(28px)",
            border: "1px solid rgba(200, 188, 168, 0.13)",
            borderRadius: "20px",
            padding: "36px",
            boxShadow:
              "0 32px 80px rgba(26, 28, 30, 0.7), 0 1px 0 rgba(238,234,226,0.06) inset",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, rgba(160,125,84,0.6), transparent)",
              backgroundSize: "200% auto",
              animation: "shimmer 3.5s linear infinite",
            }}
          />

          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "999px",
              padding: "3px",
              marginBottom: "28px",
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
                  fontFamily: "Syne, sans-serif",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  transition: "all 0.35s ease",
                  background:
                    mode === m
                      ? "linear-gradient(135deg, rgba(93,86,70,0.85), rgba(62,89,116,0.65))"
                      : "transparent",
                  color: mode === m ? "#EEEAE2" : "#8B8680",
                  boxShadow:
                    mode === m ? "0 2px 10px rgba(93,86,70,0.35)" : "none",
                }}
              >
                {m === "create" ? "New Room" : "Join Room"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEnter}>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontFamily: "Syne, sans-serif",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "2.5px",
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
                  background: "rgba(238, 234, 226, 0.04)",
                  border: "1px solid rgba(200, 188, 168, 0.12)",
                  borderRadius: "10px",
                  color: "#EEEAE2",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "15px",
                  fontWeight: 300,
                  outline: "none",
                  caretColor: "#A07D54",
                  transition: "border-color 0.35s ease, box-shadow 0.35s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(160, 125, 84, 0.45)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(160,125,84,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(200, 188, 168, 0.12)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <AnimatePresence>
              {mode === "join" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginBottom: "16px", overflow: "hidden" }}
                >
                  <label
                    style={{
                      display: "block",
                      fontFamily: "Syne, sans-serif",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "2.5px",
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
                      background: "rgba(238, 234, 226, 0.04)",
                      border: "1px solid rgba(200, 188, 168, 0.12)",
                      borderRadius: "10px",
                      color: "#EEEAE2",
                      fontFamily: "DM Mono, monospace",
                      fontSize: "13px",
                      outline: "none",
                      caretColor: "#A07D54",
                      boxSizing: "border-box",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

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
                    marginBottom: "14px",
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                position: "relative",
                width: "100%",
                padding: "14px 0",
                background:
                  loading || !name.trim()
                    ? "rgba(93,86,70,0.25)"
                    : "linear-gradient(135deg, #5D5646 0%, #3E5974 100%)",
                border: "1px solid rgba(200, 188, 168, 0.15)",
                borderRadius: "999px",
                color: "#EEEAE2",
                fontFamily: "Syne, sans-serif",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "1px",
                cursor: loading || !name.trim() ? "not-allowed" : "pointer",
                overflow: "hidden",
                transition:
                  "opacity 0.35s ease, transform 0.2s ease, box-shadow 0.35s ease",
                opacity: loading || !name.trim() ? 0.45 : 1,
                boxShadow:
                  loading || !name.trim()
                    ? "none"
                    : "0 4px 20px rgba(93, 86, 70, 0.4)",
              }}
              onMouseEnter={(e) => {
                if (!loading && name.trim())
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1.015)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1)";
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
                      "linear-gradient(90deg, transparent, rgba(212,160,23,0.22), transparent)",
                    backgroundSize: "200% auto",
                    animation: "shimmer 2.2s linear infinite",
                  }}
                />
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: "22px",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(200,188,168,0.06)",
              borderRadius: "8px",
              fontFamily: "DM Mono, monospace",
              fontSize: "9px",
              letterSpacing: "1.5px",
              color: "#8B8680",
              textAlign: "center",
              lineHeight: 1.8,
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
