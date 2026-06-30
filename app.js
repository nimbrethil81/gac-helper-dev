// ─── ROUTER ──────────────────────────────────────────────────────────────────

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || "data").toLowerCase();

  if (action === "roster") {
    return jsonOut(fetchRoster(params.allyCode));
  }

  return jsonOut(buildDataPayload());
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Resolve a column index by header name, falling back to a fixed index
// so the script keeps working if a header is renamed or absent.
function col(headers, name, fallback) {
  const idx = headers.indexOf(name);
  return idx >= 0 ? idx : fallback;
}

// ─── DATA PAYLOAD (default action) ───────────────────────────────────────────

function buildDataPayload() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const countersSheet      = ss.getSheetByName("Counters");
  const counterDefsSheet   = ss.getSheetByName("Counter_Definitions");
  const counterCompSheet   = ss.getSheetByName("Counter_Composition");
  const characterDefsSheet = ss.getSheetByName("Character_Definitions");

  const countersData      = countersSheet.getDataRange().getValues();
  const counterDefsData   = counterDefsSheet.getDataRange().getValues();
  const counterCompData   = counterCompSheet.getDataRange().getValues();
  const characterDefsData = characterDefsSheet.getDataRange().getValues();

  const output = {
    counters: { "5v5": {}, "3v3": {} },
    counterDefinitions: {},
    characterDefinitions: {}
  };

  //
  // COUNTERS
  //
  const counterHeaders = countersData[0];

  for (let i = 1; i < countersData.length; i++) {
    const row = countersData[i];
    const entry = {};
    counterHeaders.forEach((h, idx) => { entry[h] = row[idx]; });

    const mode = entry["Mode"];
    const team = entry["Defence Team"];

    if (!output.counters[mode]) output.counters[mode] = {};
    if (!output.counters[mode][team]) output.counters[mode][team] = [];

    output.counters[mode][team].push({
      counterId:   entry["Counter_ID"],
      counter:     entry["Counter Team"],
      tier:        entry["Tier"],
      bannerScore: entry["Banner Score"],
      undersize:   entry["Undersize"],
      notes:       entry["Notes"]
    });
  }

  //
  // COUNTER DEFINITIONS
  //
  for (let i = 1; i < counterDefsData.length; i++) {
    const row = counterDefsData[i];
    const counterId = String(row[0]).trim();
    if (!counterId) continue;

    output.counterDefinitions[counterId] = {
      name:        String(row[1]).trim(),
      required:    [],
      recommended: []
    };
  }

  //
  // COUNTER COMPOSITION
  //
  for (let i = 1; i < counterCompData.length; i++) {
    const row         = counterCompData[i];
    const counterId   = String(row[0]).trim();
    const characterId = String(row[1]).trim();
    const role        = String(row[2]).trim().toUpperCase();

    if (!counterId || !characterId) continue;

    if (!output.counterDefinitions[counterId]) {
      output.counterDefinitions[counterId] = {
        name: counterId, required: [], recommended: []
      };
    }

    if (role === "REQUIRED") {
      output.counterDefinitions[counterId].required.push(characterId);
    } else if (role === "RECOMMENDED") {
      output.counterDefinitions[counterId].recommended.push(characterId);
    }
  }

  //
  // CHARACTER DEFINITIONS
  // Returns { name, unitType, externalId }. externalId is the swgoh.gg base_id,
  // read by header so it's optional until the External_ID column is added.
  //
  const charHeaders = characterDefsData[0];
  const cId   = col(charHeaders, "Character_ID",   0);
  const cName = col(charHeaders, "Character_Name", 1);
  const cType = col(charHeaders, "Unit_Type",      2);
  const cExt  = charHeaders.indexOf("External_ID"); // -1 if not present yet

  for (let i = 1; i < characterDefsData.length; i++) {
    const row = characterDefsData[i];
    const characterId = String(row[cId]).trim();
    if (!characterId) continue;

    output.characterDefinitions[characterId] = {
      name:       String(row[cName]).trim(),
      unitType:   String(row[cType]).trim().toUpperCase(),
      externalId: cExt >= 0 ? String(row[cExt]).trim() : ""
    };
  }

  return output;
}

// ─── ROSTER FETCH (action=roster) ────────────────────────────────────────────
// Thin proxy: server-side call to swgoh.gg, returns base_ids only. The client
// maps base_id → Character_ID and classifies, keeping this endpoint dumb.

function fetchRoster(allyCodeRaw) {
  const allyCode = String(allyCodeRaw || "").replace(/\D/g, "");
  if (allyCode.length !== 9) {
    return { ok: false, error: "invalid_ally_code" };
  }

  const url = "https://swgoh.gg/api/player/" + allyCode + "/";

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: { "Accept": "application/json", "User-Agent": "gac-helper" }
    });
  } catch (err) {
    return { ok: false, error: "fetch_failed", detail: String(err) };
  }

  const code = resp.getResponseCode();
  if (code === 404) return { ok: false, error: "not_found" };
  if (code === 429) return { ok: false, error: "rate_limited" };
  if (code !== 200) return { ok: false, error: "fetch_failed", status: code };

  let parsed;
  try {
    parsed = JSON.parse(resp.getContentText());
  } catch (err) {
    return { ok: false, error: "bad_response" };
  }

  const units = (parsed && parsed.units) || [];
  const ownedBaseIds = [];
  units.forEach(u => {
    const baseId = (u && u.data && u.data.base_id) || (u && u.base_id);
    if (baseId) ownedBaseIds.push(String(baseId));
  });

  return {
    ok: true,
    allyCode: allyCode,
    syncedAt: new Date().toISOString(),
    ownedBaseIds: ownedBaseIds
  };
}
