import { Router, Request, Response } from "express";
import { getAdminMetrics } from "../services/adminMetrics";

const router = Router();

// Basic admin authentication via API key header
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: Request, res: Response, next: () => void) {
  const providedKey = req.headers["x-admin-api-key"];
  if (!ADMIN_API_KEY || providedKey !== ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized: Admin access required" });
    return;
  }
  next();
}

router.get("/metrics", requireAdmin, async (req: Request, res: Response) => {
  try {
    const start = req.query.start
      ? new Date(req.query.start as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = req.query.end ? new Date(req.query.end as string) : new Date();

    const timeRange = { start, end };

    const metrics = await getAdminMetrics(timeRange);

    res.json({
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      metrics,
    });
  } catch (err: any) {
    console.error("[admin] Error fetching metrics:", err);
    res.status(500).json({
      error: "Failed to fetch admin metrics",
      details: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
});

export default router;
