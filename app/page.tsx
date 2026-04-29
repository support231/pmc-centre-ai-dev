"use client";

import { useState, useRef, useEffect } from "react";

type Mode = "PMC" | "GENERAL" | "LIVE" | "";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  files?: File[]; // ✅ NEW: files tied to THIS message only
};

// ===============================
// BUILD CHAT HISTORY (NEW)
// ===============================

const buildHistory = (messages: ChatMessage[]) => {
  try {
    return messages.slice(-5).map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text || msg.message || "",
    }));
  } catch (error) {
    console.error("Error building history:", error);
    return [];
  }
};

/* =======================
   FILE TYPE CONTROL
   ======================= */

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const BLOCKED_FILE_MESSAGE =
  "Excel and PowerPoint files are not supported. " +
  "Please upload PDF, Word, text, or image files.";

/* =======================
   MAIN COMPONENT
   ======================= */

export default function Home() {
  const [mode, setMode] = useState<Mode>("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ CHANGED: multiple pending files (per message)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const selectedFile = selectedFiles[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* =======================
     AUTO SCROLL
     ======================= */

  useEffect(() => {

  // -----------------------------
  // USER DATA STORAGE
  // -----------------------------
  (window as any).PMC_USER = {
    userId: null,
    email: null
  };

  const handler = (event: MessageEvent) => {

    console.log("📩 RAW MESSAGE:", event.data);

    const data = event.data;

    // =============================
    // ✅ USER DATA
    // =============================
    if (data?.type === "USER_DATA") {

      (window as any).PMC_USER = {
        userId: data.userId,
        email: data.email
      };

      console.log("✅ User received:", (window as any).PMC_USER);
    }

    // =============================
    // 🔥 LOAD CHAT (NEW)
    // =============================
    if (data?.type === "LOAD_CHAT") {

      console.log("📥 Loading chat:", data.messages);

      if (!data.messages || data.messages.length === 0) return;

      const formatted: ChatMessage[] = data.messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));

      setMessages(formatted);

      // scroll after render
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

  };

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
  };

}, []);
  /* =======================
     MODE / CHAT RESET
     ======================= */

  function onModeChange(m: Mode) {
    setMode(m);
    setMessages([]);
    setInput("");
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* =======================
     FILE HANDLING
     ======================= */

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: File[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(BLOCKED_FILE_MESSAGE);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /* =======================
   SEND MESSAGE
   ======================= */

async function sendMessage() {
  if (!input.trim() || !mode) return;

  const questionText = input.trim(); // ✅ single stable variable

  const userMsg: ChatMessage = {
    role: "user",
    content: questionText,
    files: selectedFiles.length ? selectedFiles : undefined,
  };

  const updatedMessages = [...messages, userMsg];
  setMessages(updatedMessages);
  setInput("");
  setSelectedFiles([]);
  setLoading(true);

  try {
    // ✅ build context safely INSIDE function
    const contextTextLocal = updatedMessages
      .slice(-6)
      .map((m) =>
        m.role === "user"
          ? `User: ${m.content}`
          : `Assistant: ${m.content}`
      )
      .join("\n");

    const formData = new FormData();
    formData.append("question", contextTextLocal);
    formData.append("mode", mode);

    userMsg.files?.forEach((file) => {
      formData.append("file", file);
    });

// ===============================
// API CALL (UPDATED)
// ===============================

const history = buildHistory();

const response = await fetch("https://pmc-backend-dev.onrender.com/ask", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    question: input,
    mode,
    history // ✅ MAIN FIX
  })
});

    let answer = "I couldn’t process that. Please rephrase or add more detail.";

    try {
      const data = await res.json();
      answer = data?.answer || answer;
    } catch (err) {
      const text = await res.text();
      answer = text || answer;
    }

    // ✅ UI update
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: answer },
    ]);

    // ✅ Send to Wix (uses safe variable)
    try {
      const chatData = {
        type: "CHAT_DATA",
        question: questionText, // ✅ ALWAYS SAFE
        answer: answer,
        userId: (window as any).PMC_USER?.userId || "",
        email: (window as any).PMC_USER?.email || "",
        timestamp: new Date().toISOString(),
      };

      window.parent.postMessage(chatData, "*");
      console.log("📤 Sent to Wix:", chatData);
    } catch (err) {
      console.log("⚠️ postMessage failed", err);
    }

  } catch (error) {
    const fallbackAnswer = "I couldn’t process that. Please rephrase or add more detail.";

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: fallbackAnswer },
    ]);

    try {
      const chatData = {
        type: "CHAT_DATA",
        question: questionText, // ✅ SAME SAFE VARIABLE
        answer: fallbackAnswer,
        userId: (window as any).PMC_USER?.userId || "",
        email: (window as any).PMC_USER?.email || "",
        timestamp: new Date().toISOString(),
      };

      window.parent.postMessage(chatData, "*");
      console.log("📤 Sent to Wix (error):", chatData);
    } catch (err) {
      console.log("⚠️ postMessage failed", err);
    }

  } finally {
    setLoading(false);
  }
}
  /* =======================
     EDIT / COPY
     ======================= */

  function editMessage(index: number) {
    const msg = messages[index];
    if (msg.role !== "user") return;

    setInput(msg.content);
    setSelectedFiles(msg.files || []);
    setMessages(messages.slice(0, index));
  }

  function copyMessage(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function placeholderText() {
    if (mode === "PMC")
      return "Ask a Paper Machine Clothing question (forming, felt, dryer fabrics)…";
    if (mode === "GENERAL")
      return "Ask a general question, create plans, drafts, summaries…";
    if (mode === "LIVE")
      return "Ask about recent announcements or current events…";
    return "Select a mode to start…";
  }

  /* =======================
     UI
     ======================= */

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        background: "#f2f6fb",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          textAlign: "center",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 16,
          color: "#1a73e8",
        }}
      >
        Choose the mode to get the best possible answer.
      </div>

      {/* MODE CARDS */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {modeCard(
          "PMC Expert Mode",
          "Expert technical guidance on forming fabrics, press felts, and dryer fabrics.",
          "Ask PMC Question",
          "PMC",
          mode,
          onModeChange
        )}

        {modeCard(
          "General AI Assistant",
          "Everyday AI support for planning, drafting, summaries, and non-PMC questions.",
          "Ask General Question",
          "GENERAL",
          mode,
          onModeChange
        )}

        {modeCard(
          "Current Updates",
          "Recent developments, policy updates, and other time-sensitive information.",
          "View Current Updates",
          "LIVE",
          mode,
          onModeChange
        )}
      </div>

      {/* CHAT CONTAINER */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {/* TOOLBAR */}
        <div
          style={{
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "1px solid #eee",
          }}
        >
          <strong style={{ color: "#1a73e8" }}>
            {mode ? `Mode: ${mode}` : "Select a mode"}
          </strong>

          <button onClick={startNewChat} style={{ fontSize: 12 }}>
            New Chat
          </button>
        </div>

        {/* PENDING FILE PREVIEW (BEFORE SEND) */}
        {selectedFiles.length > 0 && (
          <div
            style={{
              fontSize: 12,
              padding: "6px 12px",
              background: "#eef3fb",
              borderBottom: "1px solid #ddd",
            }}
          >
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>📎 {f.name}</span>
                <button
                  onClick={() => removeFile(0)}
                  style={{
                    fontSize: 11,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CHAT MESSAGES */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                textAlign: m.role === "user" ? "right" : "left",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background:
                    m.role === "user" ? "#e8f0fe" : "#f7f9fc",
                  padding: 10,
                  borderRadius: 6,
                  maxWidth: "80%",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}

                {/* ✅ FILES NOW LIVE WITH THE MESSAGE */}
                {m.files && (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {m.files.map((f, idx) => (
                      <div key={idx}>📎 {f.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, marginTop: 2 }}>
                {m.role === "user" && (
                  <button onClick={() => editMessage(i)}>✏️</button>
                )}
                {m.role === "assistant" && (
                  <button onClick={() => copyMessage(m.content)}>📋</button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ fontSize: 12, color: "#666" }}>
              Thinking…
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* INPUT BAR */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {selectedFile && (
  <div
    style={{
      fontSize: 12,
      padding: "4px 8px",
      background: "#eef3fb",
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <span>📎 {selectedFile.name}</span>
    <button
      onClick={() => removeFile(0)}
      style={{
        fontSize: 11,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#1a73e8",
      }}
    >
      Remove
    </button>
  </div>
)}

          <button
            onClick={() => {
              if (mode === "LIVE") {
                alert(
                  "Current Updates mode does not support file upload. " +
                    "Please switch to PMC Expert Mode or General AI Assistant."
                );
                return;
              }
              fileInputRef.current?.click();
            }}
            style={{
              ...uploadBtn,
              opacity: mode === "LIVE" ? 0.5 : 1,
              cursor: mode === "LIVE" ? "not-allowed" : "pointer",
            }}
          >
            +
          </button>

          <input
            type="file"
            ref={fileInputRef}
            hidden
            multiple
            onChange={onFileSelect}
          />

          <textarea
            rows={2}
            style={{ ...textareaStyle, flex: 1 }}
            placeholder={placeholderText()}
            value={input}
            disabled={!mode || loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={sendMessage}
            disabled={!mode || loading || !input.trim()}
            style={submitBtn}
          >
            Send
          </button>
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Powered by OpenAI and PMC CENTRE’s specialized industry knowledge base
      </p>
    </main>
  );
}

/* =======================
   MODE CARD
   ======================= */

function modeCard(
  title: string,
  text: string,
  btn: string,
  value: Mode,
  active: Mode,
  setMode: (m: Mode) => void
) {
  return (
    <div
      style={{
        width: 260,
        minHeight: 140,
        padding: "10px 12px",
        borderRadius: 8,
        background: active === value ? "#e8f0fe" : "#ffffff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3 style={{ marginBottom: 4, fontSize: 16 }}>{title}</h3>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
        {text}
      </p>
      <button
        onClick={() => setMode(value)}
        style={{
          marginTop: "auto",
          padding: "8px 0",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        {btn}
      </button>
    </div>
  );
}

/* =======================
   STYLES
   ======================= */

const textareaStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ccc",
};

const submitBtn = {
  padding: "8px 16px",
  background: "#1a73e8",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const uploadBtn = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#1a73e8",
  color: "#fff",
  border: "none",
  fontSize: 18,
  cursor: "pointer",
};
