import { Router, Request, Response } from "express";
import {
  generatePatchSuggestions,
  getLatestPatchDrafts,
  getRecentPatchReports,
  applyPatchById,
} from "../services/patchGenerator";
import { reloadPatchConfig } from "../config/patchConfig";

const router = Router();
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: Request, res: Response, next: () => void) {
  const providedKey = req.headers["x-admin-api-key"];
  if (!ADMIN_API_KEY || providedKey !== ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized: Admin access required" });
    return;
  }
  next();
}

router.post("/generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const window = (req.query.window as string) === "30d" ? "30d" : "7d";
    console.log("[patch] /generate called with window:", window);
    const record = await generatePatchSuggestions(window);
    if (!record) {
      console.log("[patch] /generate: No quality events in window");
      return res.status(200).json({ created: false, message: "No quality events in window" });
    }
    console.log("[patch] /generate success:", {
      id: record.id,
      window: record.window,
      status: record.status,
      top_targets_count: record.suggestion.top_targets?.length || 0,
      rule_patches_count: record.suggestion.rule_patches?.length || 0,
    });
    const summary = record.suggestion.rule_patches
      .map((p) => p.change)
      .filter(Boolean)
      .join("; ") || record.suggestion.top_targets.map((t) => t.issues_signature).join(", ");
    res.json({ created: true, id: record.id, summary });
  } catch (err: any) {
    console.error("[patch] /generate error:", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    });
    res.status(500).json({ error: "Failed to generate patch report" });
  }
});

router.get("/latest", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 3, 10);
    const drafts = await getLatestPatchDrafts(limit);
    res.json({ patches: drafts });
  } catch (err: any) {
    console.error("[patch] /latest error:", err);
    res.status(500).json({ error: "Failed to fetch patch drafts" });
  }
});

router.get("/recent", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 3, 10);
    console.log("[patch] /recent called with limit:", limit);
    const reports = await getRecentPatchReports(limit);
    console.log("[patch] /recent returning", reports.length, "reports");
    res.json({ reports });
  } catch (err: any) {
    console.error("[patch] /recent error:", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      detail: err?.detail,
    });
    res.status(500).json({ error: "Failed to fetch patch reports" });
  }
});

/** Apply patch: set status to applied, reload config */
router.post("/apply", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      return res.status(400).json({ error: "Missing id query parameter" });
    }
    const applied = await applyPatchById(id);
    if (!applied) {
      return res.status(404).json({ error: "Patch not found" });
    }
    await reloadPatchConfig();
    res.json({ applied: true, id });
  } catch (err: any) {
    console.error("[patch] /apply error:", err);
    res.status(500).json({ error: "Failed to apply patch" });
  }
});

export default router;
