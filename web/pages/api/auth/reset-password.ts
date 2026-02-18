import type { NextApiRequest, NextApiResponse } from "next";
import type { ResetPasswordBody, ApiErrorResponse } from "@/types/api";
import { SERVER_API_URL } from "@/lib/constants";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse | { message?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { token, password } = (req.body || {}) as Partial<ResetPasswordBody>;
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters",
    });
  }
  try {
    const response = await fetch(`${SERVER_API_URL}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach API" });
  }
}
