const apiUrl = process.env.API_URL || "http://localhost:5001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }
  try {
    const response = await fetch(`${apiUrl}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Could not reach API" });
  }
}
