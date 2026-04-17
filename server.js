const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────
const webhookRouter = require("./routes/webhook");
const flowRouter = require("./routes/flows");
const analyticsRouter = require("./routes/analytics");

app.use("/webhook", webhookRouter);
app.use("/api/flows", flowRouter);
app.use("/api/analytics", analyticsRouter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`FlowDM backend running on port ${PORT}`));
