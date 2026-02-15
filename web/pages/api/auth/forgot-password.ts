import type { NextApiRequest, NextApiResponse } from "next";
import type { ForgotPasswordBody, ApiErrorResponse } from "@/types/api";

const apiUrl = process.env.API_URL || "http://localhost:5001";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse | { message?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { email } = (req.body || {}) as Partial<ForgotPasswordBody>;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  try {
    const response = await fetch(`${apiUrl}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach API" });
  }
}
