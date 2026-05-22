const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const path      = require("path");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    // Allow if no FRONTEND_URL is set (wildcard)
    if (!allowedOrigins) return cb(null, true);
    // Allow exact match or any localhost/127.0.0.1 in development
    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    cb(isAllowed ? null : new Error("CORS: origin not allowed"), isAllowed);
  },
}));
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

const webhookLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests — slow down" },
});

const db               = require("./services/db");
const requireAuth      = require("./middleware/auth");
const authRouter       = require("./routes/auth");
const webhookRouter    = require("./routes/webhook");
const flowRouter       = require("./routes/flows");
const analyticsRouter  = require("./routes/analytics");
const uploadRouter     = require("./routes/upload");
const clientsRouter    = require("./routes/clients");
const settingsRouter   = require("./routes/settings");
const contactsRouter   = require("./routes/contacts");
const broadcastsRouter = require("./routes/broadcasts");
const instagramRouter  = require("./routes/instagram");
const metaRouter       = require("./routes/meta");
const Scheduler        = require("./services/Scheduler");

app.use("/api/auth",       authRouter);
app.use("/api/instagram",  instagramRouter);
app.use("/api/meta",       metaRouter);
app.use("/webhook",        webhookLimiter, webhookRouter);
app.use("/api/flows",      requireAuth, flowRouter);
app.use("/api/analytics",  requireAuth, analyticsRouter);
app.use("/api/upload",     requireAuth, uploadRouter);
app.use("/api/clients",    requireAuth, clientsRouter);
app.use("/api/settings",   requireAuth, settingsRouter);
app.use("/api/contacts",   requireAuth, contactsRouter);
app.use("/api/broadcasts", requireAuth, broadcastsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));


const PORT = process.env.PORT || 3001;
db.init()
  .then(() => {
    Scheduler.start();
    app.listen(PORT, () => console.log(`FlowDM backend running on port ${PORT}`));
  })
  .catch((err) => { console.error("DB init failed:", err.message); process.exit(1); });
