
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }

  try {
    const response = await fetch("https://tokenwave.ru/v1/models", {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const contentType =
      response.headers.get("content-type") || "application/json";

    const body = await response.text();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");

    return res.status(response.status).send(body);
  } catch (error) {
    return res.status(502).json({
      error: "TokenWave connection failed",
      message: "Could not retrieve models from TokenWave."
    });
  }
};
