
"use client";

import { useEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const levels = [
  "Минимальное", "Низкое", "Умеренное", "Стандартное",
  "Высокое", "Очень высокое", "Максимальное", "Экстра"
];

const suggestions = [
  { icon: "✳", title: "Исследовать идею", text: "Помоги развить мою идею в полноценный проект" },
  { icon: "</>", title: "Написать код", text: "Напиши качественный и хорошо структурированный код" },
  { icon: "⌘", title: "Разобраться", text: "Объясни сложную тему простыми словами" },
  { icon: "◈", title: "Создать что-то", text: "Помоги придумать и создать что-нибудь интересное" }
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
        headers: { Authorization: `Bearer ${key}` }
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
      { role: "user", content: text }
    ];

    setMessages([...updated, { role: "assistant", content: "" }]);
    setPrompt("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: updated,
          level
        })
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
              { role: "assistant", content: answer }
            ]);
          } catch {
            // Ожидаем следующий фрагмент потока
          }
        }
      }

      buffer += decoder.decode();
      if (buffer.startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.slice(6).trim());
          answer += data.choices?.[0]?.delta?.content || "";
          setMessages([
            ...updated,
            { role: "assistant", content: answer }
          ]);
        } catch {
          // Последний фрагмент может быть служебным
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
    setModel("");
  }

  if (!connected) {
    return (
      <main className="auth-screen">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />

        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark">A<span>✳</span></div>
            <div>
              <div className="brand-name">AKIRA<span> AI</span></div>
              <div className="brand-caption">PERSONAL INTELLIGENCE</div>
            </div>
          </div>

          <div className="auth-orb">
            <div className="orb-ring ring-one" />
            <div className="orb-ring ring-two" />
            <div className="orb-core">A</div>
            <span className="orb-star star-one">✦</span>
            <span className="orb-star star-two">✧</span>
          </div>

          <div className="auth-heading">
            <div className="section-kicker">YOUR AI. YOUR RULES.</div>
            <h1>Время создавать<br /><span>нечто большее.</span></h1>
            <p>Подключи TokenWave и открой своё персональное пространство искусственного интеллекта.</p>
          </div>

          <label className="field-label" htmlFor="api-key">TOKENWAVE API KEY</label>
          <div className="auth-input-wrap">
            <span className="input-symbol">⌘</span>
            <input
              id="api-key"
              type="password"
              placeholder="Вставь свой API-ключ"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
            />
            <span className="input-lock">◈</span>
          </div>

          <button className="connect-button" onClick={connect}>
            <span>Подключить AKIRA</span>
            <span className="button-arrow">↗</span>
          </button>

          {error && <p className="error">{error}</p>}

          <div className="auth-security">
            <span>◈</span>
            Ключ хранится в локальном хранилище этого браузера.
          </div>
        </div>

        <div className="auth-footer">AKIRA AI <span>•</span> POWERED BY TOKENWAVE</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div
        className={`sidebar-backdrop ${sidebar ? "visible" : ""}`}
        onClick={() => setSidebar(false)}
      />

      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark small">A<span>✳</span></div>
            <div>
              <div className="brand-name">AKIRA<span> AI</span></div>
              <div className="brand-caption">INTELLIGENCE SYSTEM</div>
            </div>
          </div>
          <button className="mobile-close" onClick={() => setSidebar(false)}>×</button>
        </div>

        <button
          className="new-chat"
          onClick={() => {
            setMessages([]);
            setPrompt("");
            setSidebar(false);
          }}
        >
          <span className="new-chat-icon">＋</span>
          <span>Новый диалог</span>
          <span className="new-chat-shortcut">⌘ K</span>
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        <button className="nav-item active">
          <span className="nav-icon">◈</span>
          Пространство чата
          <span className="nav-indicator" />
        </button>

        <div className="sidebar-label second-label">SYSTEM</div>

        <div className="system-card">
          <div className="system-card-top">
            <span className="status-dot" />
            <span>Система активна</span>
            <span className="system-live">LIVE</span>
          </div>
          <div className="system-provider">TOKENWAVE API</div>
          <div className="system-model">{model || "Модель не выбрана"}</div>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="profile-avatar">A</div>
            <div className="profile-info">
              <b>AKIRA Workspace</b>
              <span>Personal edition</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
          <button className="disconnect-button" onClick={disconnect}>
            <span>↗</span> Отключить API
          </button>
          <div className="sidebar-version">AKIRA AI <span>VERSION 1.0</span></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setSidebar(true)}>☰</button>
            <div className="breadcrumb">
              <span>AKIRA</span>
              <i>/</i>
              <b>Workspace</b>
            </div>
          </div>

          <div className="topbar-right">
            <div className="connection-pill">
              <span className="status-dot" />
              <span>Connected</span>
            </div>
            <div className="topbar-divider" />
            <div className="topbar-model">
              <span className="model-label">MODEL</span>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="select-arrow">⌄</span>
            </div>
          </div>
        </header>

        <div className="chat-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-badge">
                <span className="welcome-badge-dot" />
                PERSONAL AI ENVIRONMENT
              </div>

              <div className="hero-symbol">
                <div className="hero-halo" />
                <div className="hero-ring hero-ring-a" />
                <div className="hero-ring hero-ring-b" />
                <div className="hero-core">A</div>
                <span className="hero-spark spark-a">✦</span>
                <span className="hero-spark spark-b">✧</span>
                <span className="hero-spark spark-c">·</span>
              </div>

              <div className="hero-copy">
                <div className="section-kicker">A NEW WAY TO THINK</div>
                <h1>Добро пожаловать<br />в <span>AKIRA.</span></h1>
                <p>Твоё пространство для идей, открытий и создания нового.<br className="desktop-break" /> С чего начнём сегодня?</p>
              </div>

              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button
                    className="suggestion-card"
                    key={item.title}
                    onClick={() => setPrompt(item.text)}
                  >
                    <span className="suggestion-icon">{item.icon}</span>
                    <span className="suggestion-content">
                      <b>{item.title}</b>
                      <small>{item.text}</small>
                    </span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>

              <div className="hero-footnote">
                <span>✳</span> Powered by your intelligence engine
              </div>
            </div>
          ) : (
            <div className="messages">
              <div className="conversation-heading">
                <div className="section-kicker">YOUR CONVERSATION</div>
                <div className="conversation-model">{model}</div>
              </div>

              {messages.map((m, i) => (
                <div className={`message-row ${m.role}`} key={i}>
                  {m.role === "assistant" && (
                    <div className="message-avatar">A<span>✳</span></div>
                  )}
                  <div className="message-body">
                    <div className="message-author">
                      {m.role === "assistant" ? "AKIRA" : "YOU"}
                      {m.role === "assistant" && <span>AI ASSISTANT</span>}
                    </div>
                    <div className="message-bubble">
                      {m.content || (loading && i === messages.length - 1
                        ? <span className="thinking"><i /><i /><i /> Думаю</span>
                        : "")}
                    </div>
                  </div>
                  {m.role === "user" && <div className="user-avatar">YOU</div>}
                </div>
              ))}
              <div id="bottom" />
            </div>
          )}
        </div>

        <div className="composer-area">
          <div className="reasoning-panel">
            <div className="reasoning-heading">
              <div className="reasoning-name">
                <span className="reasoning-icon">◈</span>
                <span>УРОВЕНЬ РАССУЖДЕНИЯ</span>
              </div>
              <div className="reasoning-value">{levels[level]}</div>
            </div>
            <div className="reasoning-control">
              <input
                type="range"
                min="0"
                max="7"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                style={{ "--progress": `${level / 7 * 100}%` } as React.CSSProperties}
              />
              <div className="reasoning-dots">
                {levels.map((l, i) => (
                  <button
                    key={l}
                    className={i <= level ? "active" : ""}
                    title={l}
                    onClick={() => setLevel(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="composer">
            <textarea
              placeholder="Спроси что угодно..."
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
            <div className="composer-footer">
              <div className="composer-meta">
                <span className="composer-meta-icon">✳</span>
                <span>{model}</span>
                <i />
                <span>Enter ↵</span>
              </div>
              <button
                className="send-button"
                disabled={loading || !prompt.trim()}
                onClick={send}
                aria-label="Отправить сообщение"
              >
                {loading ? "…" : "↑"}
              </button>
            </div>
          </div>

          {error && <p className="error composer-error">{error}</p>}
          <div className="disclaimer">
            AKIRA AI может допускать ошибки. Проверяй важную информацию.
          </div>
        </div>
      </section>
    </main>
  );
}
