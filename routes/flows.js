const express = require("express");
const router  = express.Router();
const { v4: uuid } = require("uuid");
const db      = require("../services/db");

const VALID_TRIGGERS = ["keyword", "new_follower", "any_dm", "story_reply", "comment_keyword"];
const VALID_STEPS    = ["send_message", "send_image", "send_video", "send_buttons", "delay"];

// ─── Validation ───────────────────────────────────────────────────────────────
function validateFlow(body) {
  const errors = [];

  if (!body.name || !String(body.name).trim()) {
    errors.push("name is required and must not be empty");
  }

  if (!body.trigger || typeof body.trigger !== "object") {
    errors.push("trigger is required");
  } else {
    if (!VALID_TRIGGERS.includes(body.trigger.type)) {
      errors.push(`trigger.type must be one of: ${VALID_TRIGGERS.join(", ")}`);
    } else if (["keyword", "comment_keyword"].includes(body.trigger.type)) {
      if (!Array.isArray(body.trigger.keywords) || body.trigger.keywords.length === 0) {
        errors.push("trigger.keywords must be a non-empty array for keyword/comment_keyword triggers");
      }
    }
  }

  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    body.steps.forEach((step, i) => {
      if (!VALID_STEPS.includes(step.type)) {
        errors.push(`steps[${i}].type "${step.type}" is invalid — must be one of: ${VALID_STEPS.join(", ")}`);
      } else if (step.type === "send_message") {
        if (!step.message || !String(step.message).trim()) {
          errors.push(`steps[${i}].message must not be empty`);
        }
      } else if (step.type === "send_image") {
        if (!step.imageUrl || !String(step.imageUrl).trim()) {
          errors.push(`steps[${i}].imageUrl must not be empty`);
        }
      } else if (step.type === "send_video") {
        if (!step.videoUrl || !String(step.videoUrl).trim()) {
          errors.push(`steps[${i}].videoUrl must not be empty`);
        }
      } else if (step.type === "send_buttons") {
        if (!step.text || !String(step.text).trim()) {
          errors.push(`steps[${i}].text must not be empty`);
        }
        if (!Array.isArray(step.buttons) || step.buttons.length === 0 || step.buttons.length > 3) {
          errors.push(`steps[${i}].buttons must have 1–3 buttons (Instagram button template limit)`);
        } else {
          step.buttons.forEach((btn, j) => {
            if (!btn.title || !String(btn.title).trim()) {
              errors.push(`steps[${i}].buttons[${j}].title must not be empty`);
            }
          });
        }
      } else if (step.type === "delay") {
        if (typeof step.ms !== "number" || step.ms < 0) {
          errors.push(`steps[${i}].ms must be a non-negative number`);
        }
      }
    });
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  try {
    res.json(db.getAllFlows());
  } catch (err) {
    console.error("[Flows] GET /:", err.message);
    res.status(500).json({ error: "Failed to load flows" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const flow = db.getAllFlows().find((f) => f.id === req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (err) {
    console.error("[Flows] GET /:id:", err.message);
    res.status(500).json({ error: "Failed to load flow" });
  }
});

router.post("/", (req, res) => {
  const errors = validateFlow(req.body);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const flow = { id: `flow_${uuid()}`, active: false, ...req.body };
    db.saveFlow(flow);
    res.status(201).json(flow);
  } catch (err) {
    console.error("[Flows] POST /:", err.message);
    res.status(500).json({ error: "Failed to create flow" });
  }
});

router.patch("/:id", (req, res) => {
  try {
    const flow = db.getAllFlows().find((f) => f.id === req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });

    // Only run full validation when structural fields are being changed
    if (req.body.steps !== undefined || req.body.trigger !== undefined) {
      const merged = { ...flow, ...req.body };
      const errors = validateFlow(merged);
      if (errors.length) return res.status(400).json({ errors });
    }

    const updated = { ...flow, ...req.body };
    db.saveFlow(updated);
    res.json(updated);
  } catch (err) {
    console.error("[Flows] PATCH /:id:", err.message);
    res.status(500).json({ error: "Failed to update flow" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    db.deleteFlow(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[Flows] DELETE /:id:", err.message);
    res.status(500).json({ error: "Failed to delete flow" });
  }
});

module.exports = router;
