const express    = require("express");
const router     = express.Router();
const jwt        = require("jsonwebtoken");
const crypto     = require("crypto");
const { v4: uuid } = require("uuid");
const db         = require("../services/db");
const MetaOAuth  = require("../services/MetaOAuth");
const requireAuth = require("../middleware/auth");

// ─── Password helpers (uses built-in crypto — no extra packages) ─────────────

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, hash) => {
      if (err) reject(err);
      else resolve(`${salt}:${hash.toString("hex")}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(":");
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("hex") === hash);
    });
  });
}

// ─── Admin login (existing — unchanged) ─────────────────────────────────────

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

// ─── User registration ───────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuid();
    await db.createUser({ id: userId, email, passwordHash });

    const token = jwt.sign(
      { userId, email: email.toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.status(201).json({ token, userId, email: email.toLowerCase() });
  } catch (err) {
    console.error("[Auth] Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── User login ──────────────────────────────────────────────────────────────

router.post("/user-login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Return the user's connected accounts so the frontend can set activeClientId
    const accounts = await db.getClientsByUserId(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token, userId: user.id, email: user.email, accounts });
  } catch (err) {
    console.error("[Auth] User login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── Instagram OAuth — start flow ────────────────────────────────────────────
// Requires a valid JWT. Generates a CSRF state and returns the Meta OAuth URL.

router.get("/instagram/start", requireAuth, async (req, res) => {
  try {
    if (!process.env.META_APP_ID) {
      return res.status(500).json({ error: "META_APP_ID is not configured" });
    }
    if (!process.env.BACKEND_URL) {
      return res.status(500).json({ error: "BACKEND_URL is not configured" });
    }

    const state       = crypto.randomBytes(20).toString("hex");
    const userId      = req.user.userId || null; // null for admin sessions
    await db.createOAuthState(state, userId);

    const redirectUri = `${process.env.BACKEND_URL}/api/auth/instagram/callback`;
    const authUrl     = MetaOAuth.getAuthUrl(state, redirectUri);

    res.json({ url: authUrl });
  } catch (err) {
    console.error("[Auth] Instagram start error:", err.message);
    res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

// ─── Instagram OAuth — callback from Meta ────────────────────────────────────
// Meta redirects here after the user approves or denies. No JWT — this is Meta's redirect.

router.get("/instagram/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (oauthError) {
    return res.redirect(`${frontendUrl}/connect/callback?error=cancelled`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/connect/callback?error=invalid_request`);
  }

  try {
    // Verify and consume the CSRF state — prevents replay attacks
    const stateRecord = await db.consumeOAuthState(state);
    if (!stateRecord) {
      return res.redirect(`${frontendUrl}/connect/callback?error=invalid_state`);
    }

    const redirectUri = `${process.env.BACKEND_URL}/api/auth/instagram/callback`;

    // Step 1: exchange auth code → short-lived user token
    const shortTokenData = await MetaOAuth.exchangeCodeForToken(code, redirectUri);

    // Step 2: exchange short-lived → long-lived token (valid ~60 days)
    const longTokenData  = await MetaOAuth.exchangeForLongLivedToken(shortTokenData.access_token);
    const accessToken    = longTokenData.access_token;
    const expiresIn      = longTokenData.expires_in || 5184000; // 60 days in seconds
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Step 3: get the Meta user ID who authorized (needed for data deletion)
    const oauthUserId = await MetaOAuth.getTokenUserId(accessToken);

    // Step 4: get the user's Facebook Pages
    const pages = await MetaOAuth.getPages(accessToken);
    console.log("[Auth] Pages found:", JSON.stringify(pages));
    if (!pages.length) {
      return res.redirect(`${frontendUrl}/connect/callback?error=no_pages`);
    }

    // Step 5: find the first page with a linked Instagram Business Account
    let connectedPageId    = null;
    let connectedPageToken = null;
    let igAccountId        = null;

    for (const page of pages) {
      const igId = await MetaOAuth.getInstagramAccountForPage(page.id, page.access_token);
      if (igId) {
        connectedPageId    = page.id;
        connectedPageToken = page.access_token;
        igAccountId        = igId;
        break;
      }
    }

    if (!igAccountId) {
      return res.redirect(`${frontendUrl}/connect/callback?error=no_instagram_business`);
    }

    // Step 6: fetch Instagram profile (username, name, profile picture)
    const profile = await MetaOAuth.getInstagramProfile(igAccountId, connectedPageToken);

    // Step 7: save (or update) the client record in the database
    const clientId  = uuid();
    const savedId   = await db.saveOAuthClient({
      id:                clientId,
      name:              profile.name || profile.username || "Instagram Account",
      igUsername:        profile.username        || null,
      igAccountId:       igAccountId,
      displayName:       profile.name            || null,
      profilePictureUrl: profile.profile_picture_url || null,
      accessToken:       accessToken,
      pageId:            connectedPageId,
      pageAccessToken:   connectedPageToken,
      tokenExpiresAt:    tokenExpiresAt,
      oauthUserId:       oauthUserId,
      userId:            stateRecord.user_id     || null,
    });

    // Redirect to frontend with success params so the UI can update state
    const params = new URLSearchParams({
      success:    "1",
      clientId:   savedId,
      clientName: profile.name     || profile.username || "Instagram Account",
      igUsername: profile.username || "",
    });
    return res.redirect(`${frontendUrl}/connect/callback?${params.toString()}`);

  } catch (err) {
    console.error("[Auth] Instagram callback error:", err.message);
    return res.redirect(`${frontendUrl}/connect/callback?error=server_error`);
  }
});

module.exports = router;
