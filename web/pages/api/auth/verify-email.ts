import type { NextApiRequest, NextApiResponse } from "next";
import type {
  VerifyEmailBody,
  ApiErrorResponse,
  ApiMessageResponse,
} from "@/types/api";
import { SERVER_API_URL } from "@/lib/constants";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiErrorResponse | ApiMessageResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { token } = (req.body || {}) as Partial<VerifyEmailBody>;
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }
  try {
    const response = await fetch(`${SERVER_API_URL}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach API" });
  }
}
