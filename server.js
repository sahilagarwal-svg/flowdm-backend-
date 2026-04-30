const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const path      = require("path");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : "*",
}));
app.use(express.json());

const webhookLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests — slow down" },
});

const db              = require("./services/db");
const requireAuth     = require("./middleware/auth");
const authRouter      = require("./routes/auth");
const webhookRouter   = require("./routes/webhook");
const flowRouter      = require("./routes/flows");
const analyticsRouter = require("./routes/analytics");
const uploadRouter    = require("./routes/upload");
const clientsRouter   = require("./routes/clients");

app.use("/api/auth",      authRouter);
app.use("/webhook",       webhookLimiter, webhookRouter);
app.use("/api/flows",     requireAuth, flowRouter);
app.use("/api/analytics", requireAuth, analyticsRouter);
app.use("/api/upload",    requireAuth, uploadRouter);
app.use("/api/clients",   requireAuth, clientsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
db.init()
  .then(() => app.listen(PORT, () => console.log(`FlowDM backend running on port ${PORT}`)))
  .catch((err) => { console.error("DB init failed:", err.message); process.exit(1); });
