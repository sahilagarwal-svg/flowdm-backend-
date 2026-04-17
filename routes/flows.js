const express = require("express");
const router = express.Router();
const { v4: uuid } = require("uuid");
const db = require("../services/db");

// GET all flows
router.get("/", (req, res) => {
  res.json(db.getAllFlows());
});

// GET single flow
router.get("/:id", (req, res) => {
  const flow = db.getAllFlows().find((f) => f.id === req.params.id);
  if (!flow) return res.status(404).json({ error: "Flow not found" });
  res.json(flow);
});

// POST create flow
router.post("/", (req, res) => {
  const flow = { id: `flow_${uuid()}`, active: false, ...req.body };
  db.saveFlow(flow);
  res.status(201).json(flow);
});

// PATCH update flow (incl. toggle active)
router.patch("/:id", (req, res) => {
  const flows = db.getAllFlows();
  const flow = flows.find((f) => f.id === req.params.id);
  if (!flow) return res.status(404).json({ error: "Flow not found" });
  const updated = { ...flow, ...req.body };
  db.saveFlow(updated);
  res.json(updated);
});

// DELETE flow
router.delete("/:id", (req, res) => {
  db.deleteFlow(req.params.id);
  res.json({ success: true });
});

module.exports = router;
