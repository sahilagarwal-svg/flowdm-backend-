const fetch = require("node-fetch");

const GRAPH = "https://graph.facebook.com/v19.0";

const SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

// Build the Meta OAuth dialog URL the user is redirected to
function getAuthUrl(state, redirectUri) {
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id",    process.env.META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state",        state);
  url.searchParams.set("scope",        SCOPES);
  return url.toString();
}

// Exchange the auth code Meta sends back for a short-lived user token
async function exchangeCodeForToken(code, redirectUri) {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id",     process.env.META_APP_ID);
  url.searchParams.set("client_secret", process.env.APP_SECRET);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("code",          code);

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Token exchange failed (${res.status})`);
  }
  return data; // { access_token, token_type }
}

// Exchange short-lived token for a long-lived token valid 60 days
async function exchangeForLongLivedToken(shortLivedToken) {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type",       "fb_exchange_token");
  url.searchParams.set("client_id",        process.env.META_APP_ID);
  url.searchParams.set("client_secret",    process.env.APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Long-lived token exchange failed (${res.status})`);
  }
  return data; // { access_token, token_type, expires_in }
}

// Refresh an expiring long-lived token — same endpoint, same grant type
async function refreshLongLivedToken(longLivedToken) {
  return exchangeForLongLivedToken(longLivedToken);
}

// Get the Facebook/Meta user ID that owns this token
async function getTokenUserId(accessToken) {
  const res  = await fetch(`${GRAPH}/me?access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to get token user ID");
  }
  return data.id;
}

// Get all Facebook Pages the user manages (personal + Business Manager)
async function getPages(userAccessToken) {
  // First try personal pages via /me/accounts
  const res  = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to get pages");
  }
  const personalPages = data.data || [];
  if (personalPages.length) return personalPages;

  // Fallback: check Business Manager owned pages
  const bizRes  = await fetch(
    `${GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const bizData = await bizRes.json();
  if (!bizRes.ok || bizData.error) return [];

  const businesses = bizData.data || [];
  const allPages   = [];

  for (const biz of businesses) {
    const pRes  = await fetch(
      `${GRAPH}/${biz.id}/owned_pages?fields=id,name,access_token&access_token=${encodeURIComponent(userAccessToken)}`
    );
    const pData = await pRes.json();
    if (pRes.ok && !pData.error && pData.data) {
      allPages.push(...pData.data);
    }
  }

  return allPages;
}

// Check if a Facebook Page has a linked Instagram Business Account
async function getInstagramAccountForPage(pageId, pageAccessToken) {
  const res  = await fetch(
    `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Failed to get IG account for page ${pageId}`);
  }
  return data.instagram_business_account?.id || null;
}

// Fetch the Instagram profile — username, display name, profile picture
async function getInstagramProfile(igAccountId, pageAccessToken) {
  const res  = await fetch(
    `${GRAPH}/${igAccountId}?fields=id,name,username,profile_picture_url&access_token=${encodeURIComponent(pageAccessToken)}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to get Instagram profile");
  }
  return data; // { id, name, username, profile_picture_url }
}

// Subscribe a Facebook Page to webhook events so Meta sends DMs/comments to our webhook
async function subscribePageToWebhook(pageId, pageAccessToken) {
  const res  = await fetch(
    `${GRAPH}/${pageId}/subscribed_apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscribed_fields: ["messages", "messaging_postbacks", "follow", "feed"],
        access_token: pageAccessToken,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to subscribe page to webhook");
  }
  return data;
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getTokenUserId,
  getPages,
  getInstagramAccountForPage,
  getInstagramProfile,
  subscribePageToWebhook,
};
