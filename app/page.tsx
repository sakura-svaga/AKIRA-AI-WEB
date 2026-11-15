
"use client";

import { useEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const levels = [
  "Минимальное",
  "Низкое",
  "Умеренное",
  "Стандартное",
  "Высокое",
  "Очень высокое",
  "Максимальное",
  "Экстра",
];

export default function Home() {
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [level, setLevel] = useState(3);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("akira_tokenwave_key");
    if (saved) setKey(saved);
  }, []);

  async function connect() {
    if (!key.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка подключения");
      const list = (data.data || [])
        .map((item: { id: string }) => item.id)
        .filter(Boolean);
      if (!list.length) throw new Error("Список моделей пуст");
      setModels(list);
      setModel(list[0]);
      localStorage.setItem("akira_tokenwave_key", key);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка подключения");
    }
  }

  async function send() {
    const text = prompt.trim();
    if (!text || loading || !model) return;

    const updated: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(updated);
    setPrompt("");
    setLoading(true);
    setError("");

    setMessages([...updated, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: updated,
          level,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка генерации");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Поток ответа недоступен");

      const decoder = new TextDecoder();
      let answer = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const data = JSON.parse(payload);
            answer += data.choices?.[0]?.delta?.content || "";
            setMessages([
              ...updated,
              { role: "assistant", content: answer },
            ]);
          } catch {
            // Пропускаем неполный пакет потока
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setMessages((current) => current.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    localStorage.removeItem("akira_tokenwave_key");
    setKey("");
    setConnected(false);
    setModels([]);
    setMessages([]);
  }

  if (!connected) {
    return (
      <main className="login">
        <div className="login-card">
          <div className="logo">A</div>
          <div className="eyebrow">PERSONAL AI WORKSPACE</div>
          <h1>AKIRA<span> AI</span></h1>
          <p className="muted">
            Твой собственный интеллектуальный центр.
          </p>
          <label>TokenWave API Key</label>
          <input
            type="password"
            placeholder="Вставь свой API-ключ"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="primary" onClick={connect}>
            Подключить TokenWave <span>→</span>
          </button>
          {error && <p className="error">{error}</p>}
          <p className="footnote">
            Ключ сохраняется локально в браузере.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="brand">
          <div className="small-logo">A</div>
          <b>AKIRA <span>AI</span></b>
          <button className="icon-btn close-sidebar"
            onClick={() => setSidebar(false)}>×</button>
        </div>
        <button className="new-chat" onClick={() => setMessages([])}>
          ＋ Новый чат
        </button>
        <div className="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <div className="side-item">◈ Все чаты</div>
        <div className="side-item">⌕ Поиск</div>
        <div className="side-bottom">
          <div className="connection"><i /> TokenWave подключён</div>
          <button className="side-item" onClick={disconnect}>
            ⚙ Отключить API
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-btn menu-btn"
            onClick={() => setSidebar(!sidebar)}>☰</button>
          <div className="top-model">
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="online">●</span>
          </div>
          <div className="top-right">AKIRA <span>PERSONAL</span></div>
        </header>

        <div className="chat">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-symbol">✳</div>
              <div className="eyebrow">YOUR INTELLIGENCE SPACE</div>
              <h2>Чем займёмся<br /><span>сегодня?</span></h2>
              <p>Выбери модель и начни разговор.</p>
              <div className="suggestions">
                {["Помоги разобраться в сложной теме",
                  "Напиши качественный код",
                  "Проанализируй мою идею"].map((s) => (
                  <button key={s} onClick={() => setPrompt(s)}>{s} ↗</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m, i) => (
                <div className={`message ${m.role}`} key={i}>
                  {m.role === "assistant" &&
                    <div className="avatar">A</div>}
                  <div className="bubble">
                    {m.content || (loading && i === messages.length - 1
                      ? "Думаю…" : "")}
                  </div>
                </div>
              ))}
              <div id="bottom" />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="reasoning">
            <span>◈ РАССУЖДЕНИЕ</span>
            <b>{levels[level]}</b>
            <input
              type="range" min="0" max="7" value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ "--progress": `${level / 7 * 100}%` } as React.CSSProperties}
            />
            <div className="dots">
              {levels.map((l, i) => (
                <button key={l}
                  className={i <= level ? "active" : ""}
                  title={l} onClick={() => setLevel(i)} />
              ))}
            </div>
          </div>
          <div className="composer">
            <textarea
              placeholder="Напиши сообщение AKIRA..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
            />
            <div className="composer-tools">
              <span>Модель: {model}</span>
              <button className="send" disabled={loading || !prompt.trim()}
                onClick={send}>{loading ? "…" : "↑"}</button>
            </div>
          </div>
          <div className="disclaimer">
            AKIRA AI может допускать ошибки. Проверяй важную информацию.
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    </main>
  );
}
