
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }

  const { model, messages, level = 4 } = req.body || {};

  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({
      error: "Model and messages are required"
    });
  }

  const effortLevels = [
    "minimal",
    "low",
    "low",
    "medium",
    "medium",
    "high",
    "high",
    "high"
  ];

  const effort = effortLevels[
    Math.max(0, Math.min(7, Number(level) || 0))
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(
      "https://tokenwave.ru/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          reasoning_effort: effort
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).send(errorBody);
    }

    if (!response.body) {
      return res.status(502).json({
        error: "Empty response from TokenWave"
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (res.destroyed) {
        await reader.cancel();
        break;
      }

      if (!res.write(Buffer.from(value))) {
        await new Promise(resolve => res.once("drain", resolve));
      }
    }

    return res.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(502).json({
        error: "TokenWave request failed"
      });
    }

    return res.end();
  } finally {
    clearTimeout(timeout);
  }
};
