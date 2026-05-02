const { google } = require("googleapis");
const path = require("path");

const CREDENTIALS_PATH = path.join(__dirname, "../config/google-credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const HEADERS = [
  "Timestamp (IST)",
  "Phone (As Sent)",
  "Phone (Normalized)",
  "Full Name",
  "Instagram Username",
  "Instagram User ID",
  "Original Message",
  "Source",
];

function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
  });
}

function extractSheetId(urlOrId) {
  if (!urlOrId) return null;
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

// Detects phone numbers in various formats:
// 9999999999 | +91 9999999999 | +919999999999 | 919999999999 | 09999999999
// +1 2125551234 | +44 7700900000 etc.
function extractPhoneNumber(text) {
  const msg = (text || "").trim();

  // Message must consist only of digits, +, spaces, dashes, dots, parentheses
  if (!/^[\+\d\s\-\.\(\)]{7,20}$/.test(msg)) return null;

  const digits = msg.replace(/\D/g, "");

  // Valid phone length: 7–15 digits
  if (digits.length < 7 || digits.length > 15) return null;

  return {
    raw: msg,
    digits,
    normalized: normalizeDigits(digits),
  };
}

function normalizeDigits(digits) {
  if (digits.length === 10) return "+91" + digits;                          // Indian 10-digit
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1); // 0XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits; // 91XXXXXXXXXX
  return "+" + digits;                                                      // everything else
}

async function appendLead(sheetUrl, leadData) {
  if (!sheetUrl) return;
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Add headers if the sheet is empty
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
    });
    if (!existing.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet1!A1:H1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [HEADERS] },
      });
    }
  } catch (err) {
    // If headers check fails, continue anyway and try to append
    console.warn("[GoogleSheets] Header check failed:", err.message);
  }

  const row = [
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    leadData.phoneRaw || "",
    leadData.phoneNormalized || "",
    leadData.name || "",
    leadData.username || "",
    leadData.igUserId || "",
    leadData.messageText || "",
    leadData.source || "Instagram DM",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:H",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  console.log(
    `[GoogleSheets] Lead saved — ${leadData.phoneNormalized} | ${leadData.username || leadData.igUserId}`
  );
}

module.exports = { appendLead, extractPhoneNumber };
