import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiErrorResponse } from "@/types/api";
import { SERVER_API_URL } from "@/lib/constants";

type RegisterApiBody = { email: string; password: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse | Record<string, unknown>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { email, password } = (req.body || {}) as Partial<RegisterApiBody>;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const response = await fetch(`${SERVER_API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data as ApiErrorResponse);
    }
    return res.status(201).json(data as Record<string, unknown>);
  } catch {
    return res.status(502).json({ error: "Could not reach API" });
  }
}
