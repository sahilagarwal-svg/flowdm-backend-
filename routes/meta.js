const express    = require("express");
const router     = express.Router();
const crypto     = require("crypto");
const { v4: uuid } = require("uuid");
const db         = require("../services/db");

// Verify the signed_request Meta sends with data deletion callbacks.
// Signature = base64url(HMAC-SHA256(payload, APP_SECRET))
function parseSignedRequest(signedRequest, appSecret) {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) throw new Error("Malformed signed_request");

  const [encodedSig, payload] = parts;

  // Decode the signature Meta sent
  const sig = Buffer.from(
    encodedSig.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );

  // Compute the expected signature
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expected)) {
    throw new Error("Invalid signed_request signature");
  }

  return JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  );
}

// POST /api/meta/data-deletion
// Meta calls this when a user removes your app and requests their data be deleted.
// Must respond with a status URL and confirmation code within 30 seconds.
router.post("/data-deletion", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const signedRequest = req.body?.signed_request || req.query?.signed_request;
    if (!signedRequest) {
      return res.status(400).json({ error: "Missing signed_request" });
    }

    const payload = parseSignedRequest(signedRequest, process.env.APP_SECRET);
    const oauthUserId = payload.user_id;

    if (!oauthUserId) {
      return res.status(400).json({ error: "Missing user_id in payload" });
    }

    const deletionId = uuid();

    // Record the deletion request before doing the actual deletion
    await db.createDataDeletion({ id: deletionId, oauthUserId });

    // Delete all data associated with this Meta user ID
    await db.deleteUserData(oauthUserId);

    // Mark it complete
    await db.completeDataDeletion(deletionId);

    console.log(`[Meta] Data deletion completed for oauth_user_id=${oauthUserId} code=${deletionId}`);

    const statusUrl = `${process.env.BACKEND_URL}/api/meta/data-deletion-status/${deletionId}`;
    res.json({ url: statusUrl, confirmation_code: deletionId });
  } catch (err) {
    console.error("[Meta] Data deletion error:", err.message);
    res.status(500).json({ error: "Deletion failed" });
  }
});

// GET /api/meta/data-deletion-status/:code
// Meta polls this URL to confirm the deletion actually happened.
router.get("/data-deletion-status/:code", async (req, res) => {
  try {
    const record = await db.getDataDeletion(req.params.code);
    if (!record) return res.status(404).json({ error: "Deletion record not found" });
    res.json({
      confirmation_code: record.id,
      status:            record.status,
      completed_at:      record.completed_at || null,
    });
  } catch (err) {
    console.error("[Meta] Deletion status error:", err.message);
    res.status(500).json({ error: "Failed to fetch deletion status" });
  }
});

module.exports = router;
