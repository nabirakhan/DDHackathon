// client/src/pages/Login.tsx
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { setDisplayName } from "../hooks/useAuth";
import { SoftAurora } from "../components/ui/SoftAurora";

const SERVER_URL = import.meta.env.VITE_SERVER_URL as string;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(202,210,197,0.12)",
  borderRadius: "12px",
  color: "#CAD2C5",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px", fontWeight: 400,
  outline: "none",
  caretColor: "#84A98C",
  transition: "border-color 0.25s ease, box-shadow 0.25s ease",
  boxSizing: "border-box",
};

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
    if (!name.trim()) { inputRef.current?.focus(); return; }
    setError(null);
    setLoading(true);
    try {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const fakeEmail = `op-${crypto.randomUUID()}@ligma.internal`;
        const { data, error: authErr } = await supabase.auth.signUp({ email: fakeEmail, password: crypto.randomUUID() });
        if (authErr) throw authErr;
        session = data.session;
      }
      const displayName = name.trim();
      setDisplayName(displayName);
      if (!session) throw new Error("No session");
      if (mode === "join" && roomCode.trim()) { navigate(`/room/${roomCode.trim()}`); return; }
      const res = await fetch(`${SERVER_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: `${displayName}'s Session` }),
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
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#141f1f" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <SoftAurora color1="#354F52" color2="#52796F" speed={0.18} brightness={0.45} noiseFrequency={0.7} noiseAmplitude={0.6} bandHeight={0.45} bandSpread={0.4} enableMouseInteraction mouseInfluence={0.4} />
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "radial-gradient(ellipse at center, rgba(20,31,31,0.1) 0%, rgba(20,31,31,0.65) 100%)" }} />

      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px" }}>
        <motion.div
          initial={{ opacity: 0, y: -24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "48px" }}
        >
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: "72px", fontWeight: 800, letterSpacing: "-4px", color: "#CAD2C5", lineHeight: 1, marginBottom: "12px" }}>
            LIGMA
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "10px", letterSpacing: "4px", color: "rgba(202,210,197,0.35)", textTransform: "uppercase", fontWeight: 500 }}>
            Live Interactive Group Meeting Assistant
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: "100%", maxWidth: "380px",
            background: "rgba(47, 62, 70, 0.72)",
            backdropFilter: "blur(40px) saturate(150%)",
            WebkitBackdropFilter: "blur(40px) saturate(150%)",
            border: "1px solid rgba(202, 210, 197, 0.10)",
            borderRadius: "2rem",
            padding: "32px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(132,169,140,0.5), transparent)", backgroundSize: "200% auto", animation: "shimmer 4s linear infinite" }} />

          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: "999px", padding: "3px", marginBottom: "24px", border: "1px solid rgba(202,210,197,0.07)" }}>
            {(["create", "join"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); }} style={{
                flex: 1, padding: "8px 0", borderRadius: "999px", border: "none", cursor: "pointer",
                fontFamily: "Syne, sans-serif", fontSize: "11px", fontWeight: 800,
                letterSpacing: "1.5px", textTransform: "uppercase", transition: "all 0.3s ease",
                background: mode === m ? "linear-gradient(135deg, #52796F, #354F52)" : "transparent",
                color: mode === m ? "#CAD2C5" : "rgba(202,210,197,0.4)",
                boxShadow: mode === m ? "0 2px 10px rgba(0,0,0,0.3)" : "none",
              }}>
                {m === "create" ? "New Room" : "Join Room"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEnter}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontFamily: "Syne, sans-serif", fontSize: "10px", fontWeight: 800, letterSpacing: "2px", color: "rgba(202,210,197,0.4)", textTransform: "uppercase", marginBottom: "8px" }}>
                Operative Name
              </label>
              <input ref={inputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Enter your name..." maxLength={32} style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "rgba(132,169,140,0.45)"; e.target.style.boxShadow = "0 0 0 3px rgba(82,121,111,0.12)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(202,210,197,0.12)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <AnimatePresence>
              {mode === "join" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: "12px", overflow: "hidden" }}>
                  <label style={{ display: "block", fontFamily: "Syne, sans-serif", fontSize: "10px", fontWeight: 800, letterSpacing: "2px", color: "rgba(202,210,197,0.4)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Room ID
                  </label>
                  <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Paste room ID..." style={{ ...inputStyle, fontFamily: "DM Mono, monospace", fontSize: "13px" }} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px" }}>
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading || !name.trim()} style={{
              width: "100%", padding: "13px 0",
              background: loading || !name.trim() ? "rgba(82,121,111,0.2)" : "linear-gradient(135deg, #52796F 0%, #354F52 100%)",
              border: "1px solid rgba(132,169,140,0.2)",
              borderRadius: "999px", color: "#CAD2C5",
              fontFamily: "Syne, sans-serif", fontSize: "14px", fontWeight: 800,
              letterSpacing: "0.5px", cursor: loading || !name.trim() ? "not-allowed" : "pointer",
              opacity: loading || !name.trim() ? 0.5 : 1,
              transition: "opacity 0.25s ease, filter 0.2s ease",
              boxShadow: loading || !name.trim() ? "none" : "0 4px 20px rgba(82,121,111,0.35)",
            }}
              onMouseEnter={(e) => { if (!loading && name.trim()) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.12)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)"; }}
            >
              {loading ? "Connecting..." : mode === "create" ? "Open Room →" : "Join Room →"}
            </button>
          </form>

          <div style={{ marginTop: "20px", textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: "9px", letterSpacing: "1.5px", color: "rgba(202,210,197,0.2)", textTransform: "uppercase" }}>
            Anonymous access enabled · No credentials stored
          </div>
        </motion.div>
      </div>
    </div>
  );
}
