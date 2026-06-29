// app.js
const APP_VERSION = "1.8";
const API_URL = "https://script.google.com/macros/s/AKfycbwSg1axISAAWN2AIMq5U6suLdj9yrfgeT1h2Nys_NT2M0D-9NA-xJ8YVKKMLKKiDcKMdA/exec";

let gacData = {};
let counterDefinitions = {};
let characterDefinitions = {};
let currentMode = "5v5";
let currentView = "counters";
let usedTeams = JSON.parse(localStorage.getItem("usedTeams") || "[]");
let searchText = "";
let ownedCharacters = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
let rosterSearch = "";
let bannerData = JSON.parse(
    localStorage.getItem("bannerData") || '{"myScore":0,"oppScore":0,"remaining":0}'
);
let counterFilter = localStorage.getItem("counterFilter") || "all";

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        gacData = data.counters;
        counterDefinitions = data.counterDefinitions;
        characterDefinitions = data.characterDefinitions;

        render();
    } catch (error) {
        document.getElementById("app").innerHTML =
            "<p style='padding:20px;color:#ff6666;'>Failed to load data. Please check your connection and refresh.</p>";
        console.error(error);
    }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getCharacterName(characterId) {
    const def = characterDefinitions[characterId];
    if (!def) return characterId;
    return def.name || characterId;
}

function getCharacterList() {
    return Object.entries(characterDefinitions)
        .filter(([, def]) => def.unitType === "CHARACTER")
        .map(([id, def]) => ({ id, name: def.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getTierColour(tier) {
    switch ((tier || "").toUpperCase()) {
        case "S": return "#1976D2";
        case "A": return "#4CAF50";
        case "B": return "#FF9800";
        case "C": return "#F44336";
        default:  return "#999999";
    }
}

function getUsedTeamCount() {
    return usedTeams.length;
}

function hasRoster() {
    return ownedCharacters.length > 0;
}

// ─── OWNERSHIP ───────────────────────────────────────────────────────────────

function getOwnership(counterId) {
    const def = counterDefinitions[counterId];

    if (!def) {
        return { owned: false, missing: ["Missing definition"] };
    }

    const required = def.required || [];
    const missing = required.filter(
        characterId => !ownedCharacters.includes(characterId)
    );

    return {
        owned: missing.length === 0,
        missing
    };
}

// Returns "available" | "used" | "not-owned"
// Precedence: not-owned dominates; used only applies to owned counters.
function getCounterStatus(counterId) {
    const { owned } = getOwnership(counterId);
    if (!owned) return "not-owned";
    if (usedTeams.includes(counterId)) return "used";
    return "available";
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

function setView(view) {
    currentView = view;
    render();
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
    const app = document.getElementById("app");

    let viewHtml;
    if (currentView === "counters") {
        viewHtml = renderCounters();
    } else if (currentView === "roster") {
        viewHtml = renderRoster();
    } else {
        viewHtml = renderBanners();
    }

    app.innerHTML = `
${viewHtml}

<div class="footer">v${APP_VERSION}</div>

<nav class="bottom-nav">
    <button class="nav-button ${currentView === "counters" ? "active" : ""}" onclick="setView('counters')">
        <span class="nav-icon">⚔️</span>
        COUNTERS
    </button>
    <button class="nav-button ${currentView === "banners" ? "active" : ""}" onclick="setView('banners')">
        <span class="nav-icon">📊</span>
        BANNERS
    </button>
    <button class="nav-button ${currentView === "roster" ? "active" : ""}" onclick="setView('roster')">
        <span class="nav-icon">👤</span>
        ROSTER
    </button>
</nav>
`;

    if (currentView === "counters") {
        showCounters();
    }
}

// ─── COUNTERS VIEW ───────────────────────────────────────────────────────────

function renderCounters() {

    const teams = Object.keys(gacData[currentMode] || {})
        .filter(team =>
            team.toLowerCase().includes(searchText.toLowerCase())
        )
        .sort((a, b) => a.localeCompare(b));

    return `
<div class="round-card">
    <div class="round-card-row">
        <div>
            <div class="round-title">🏆 CURRENT ROUND</div>
            <div class="round-stat">Used Teams: ${getUsedTeamCount()}</div>
        </div>
        <button class="reset-button-inline" onclick="resetRound()">Reset Round</button>
    </div>
</div>

<div class="mode-toggle">
    <button class="mode-button ${currentMode === "5v5" ? "active" : ""}" onclick="setMode('5v5')">5v5</button>
    <button class="mode-button ${currentMode === "3v3" ? "active" : ""}" onclick="setMode('3v3')">3v3</button>
</div>

<input
    type="text"
    id="searchBox"
    class="search-box"
    placeholder="Search defence team..."
    value="${searchText}"
    oninput="updateSearch(this.value)"
>

<select id="teamSelect" class="team-select" onchange="showCounters()">
    ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
</select>

<div class="counter-filter">
    <button class="counter-filter-btn ${counterFilter === "all"       ? "active" : ""}" data-filter="all"       onclick="setCounterFilter('all')">All</button>
    <button class="counter-filter-btn ${counterFilter === "owned"     ? "active" : ""}" data-filter="owned"     onclick="setCounterFilter('owned')">Owned</button>
    <button class="counter-filter-btn ${counterFilter === "available" ? "active" : ""}" data-filter="available" onclick="setCounterFilter('available')">Available</button>
</div>

<div id="results"></div>
`;
}

function setCounterFilter(filter) {
    counterFilter = filter;
    localStorage.setItem("counterFilter", filter);

    document.querySelectorAll(".counter-filter-btn").forEach(btn => {
        btn.classList.remove("active");
    });
    const activeBtn = document.querySelector(
        `.counter-filter-btn[data-filter="${filter}"]`
    );
    if (activeBtn) activeBtn.classList.add("active");

    showCounters();
}

function setMode(mode) {
    currentMode = mode;
    render();
}

function updateSearch(value) {
    searchText = value;

    const teamSelect = document.getElementById("teamSelect");

    const teams = Object.keys(gacData[currentMode] || {})
        .filter(team =>
            team.toLowerCase().includes(searchText.toLowerCase())
        )
        .sort((a, b) => a.localeCompare(b));

    teamSelect.innerHTML =
        teams.map(team => `<option value="${team}">${team}</option>`).join("");

    showCounters();
}

function markUsed(counterId) {
    if (!usedTeams.includes(counterId)) {
        usedTeams.push(counterId);
        localStorage.setItem("usedTeams", JSON.stringify(usedTeams));
    }
    showCounters();
}

function resetRound() {
    const confirmed = confirm("Reset the round? This clears used teams and banner tracking.");
    if (!confirmed) return;

    usedTeams = [];
    localStorage.removeItem("usedTeams");

    bannerData = { myScore: 0, oppScore: 0, remaining: 0 };
    localStorage.removeItem("bannerData");

    render();
}

// ─── COUNTER CARD ─────────────────────────────────────────────────────────────

function buildCounterCardHtml(counter) {
    const status = getCounterStatus(counter.counterId);
    const ownership = getOwnership(counter.counterId);

    // Status word: green for available, muted for used and not-owned
    const statusClass = status === "available" ? "status-available" : "status-muted";
    const statusText  = status === "available" ? "Available"
                      : status === "used"      ? "Used"
                      : "Not owned";

    // Card dims for used and not-owned
    const dimClass = status === "available" ? "" : "used";

    return `
<div class="counter-card ${dimClass}">

    <div class="card-header">
        <div class="team-name">${counter.counter}</div>
        <span class="${statusClass}">${statusText}</span>
        <span class="tier-badge" style="background:${getTierColour(counter.tier)};">
            ${counter.tier}
        </span>
    </div>

    <div>🎯 <strong>Expected Banners:</strong> ${counter.bannerScore || "-"}</div>
    <div>👥 <strong>Undersize:</strong> ${counter.undersize || "-"}</div>

    <div>
        📝 <strong>Notes:</strong> ${counter.notes || "-"}
        ${!ownership.owned ? `
        <div style="margin-top:6px;">
            ❌ <strong>Missing:</strong>
            ${ownership.missing.map(id => getCharacterName(id)).join(", ")}
        </div>` : ""}
    </div>

    ${status === "used"
        ? ""
        : status === "available"
            ? `<button class="mark-used-button" onclick="markUsed('${counter.counterId}')">Mark Used</button>`
            : ""
    }

</div>
`;
}

// ─── SORT ─────────────────────────────────────────────────────────────────────

function tierSortValue(tier) {
    return { "S": 1, "A": 2, "B": 3, "C": 4 }[tier?.toUpperCase()] || 99;
}

// Three-tier group sort: Available → Used → Not owned.
// Within each group: tier asc, then banner score desc.
function sortCounters(counters) {
    const groupRank = { "available": 1, "used": 2, "not-owned": 3 };

    return [...counters].sort((a, b) => {
        const statusA = getCounterStatus(a.counterId);
        const statusB = getCounterStatus(b.counterId);

        const groupDiff = groupRank[statusA] - groupRank[statusB];
        if (groupDiff !== 0) return groupDiff;

        const tierDiff = tierSortValue(a.tier) - tierSortValue(b.tier);
        if (tierDiff !== 0) return tierDiff;

        return Number(b.bannerScore || 0) - Number(a.bannerScore || 0);
    });
}

// ─── SHOW COUNTERS ────────────────────────────────────────────────────────────

function showCounters() {

    const teamSelect = document.getElementById("teamSelect");
    if (!teamSelect) return;

    const resultsEl = document.getElementById("results");

    if (teamSelect.options.length === 0) {
        resultsEl.innerHTML =
            "<p class='empty-state'>No matching defence teams found.</p>";
        return;
    }

    const team = teamSelect.value;
    if (!team) return;

    const allCounters = sortCounters(
        (gacData[currentMode] && gacData[currentMode][team]) || []
    );

    // ── Roster empty hint ──────────────────────────────────────────
    // Shown only on Owned and Available filters when no roster is set up.
    if (!hasRoster() && counterFilter !== "all") {
        resultsEl.innerHTML =
            "<p class='empty-state'>Set up your roster to see which counters you can field.</p>";
        return;
    }

    // ── Filter ────────────────────────────────────────────────────
    let filtered;

    if (counterFilter === "all") {
        filtered = allCounters;

    } else if (counterFilter === "owned") {
        filtered = allCounters.filter(c =>
            getCounterStatus(c.counterId) !== "not-owned"
        );

        if (filtered.length === 0) {
            resultsEl.innerHTML =
                "<p class='empty-state'>You don't own any counters for this team.</p>";
            return;
        }

    } else {
        // "available"
        filtered = allCounters.filter(c =>
            getCounterStatus(c.counterId) === "available"
        );

        if (filtered.length === 0) {
            // Distinguish: own at least one counter (all used) vs own none
            const ownsAny = allCounters.some(c =>
                getOwnership(c.counterId).owned
            );
            resultsEl.innerHTML = ownsAny
                ? "<p class='empty-state'>You've used all your counters for this team.</p>"
                : "<p class='empty-state'>You don't own any counters for this team.</p>";
            return;
        }
    }

    resultsEl.innerHTML = filtered.map(buildCounterCardHtml).join("");
}

// ─── BANNERS VIEW ────────────────────────────────────────────────────────────

function marginText(margin) {
    if (margin > 0) return `Leading by ${margin}`;
    if (margin < 0) return `Trailing by ${Math.abs(margin)}`;
    return "Level";
}

function renderBanners() {

    const my  = Number(bannerData.myScore)  || 0;
    const opp = Number(bannerData.oppScore) || 0;
    const rem = Number(bannerData.remaining) || 0;

    const projected = my + rem;
    const margin = my - opp;

    return `
<div class="round-card">
    <div class="round-title">📊 BANNER TRACKING</div>
    <div class="round-stat">Current round score</div>
</div>

<div class="banner-form">

    <label class="banner-label" for="myScore">Your current score</label>
    <input type="number" inputmode="numeric" min="0" id="myScore" class="banner-input"
        value="${my}" oninput="updateBanner('myScore', this.value)">

    <label class="banner-label" for="oppScore">Opponent's current score</label>
    <input type="number" inputmode="numeric" min="0" id="oppScore" class="banner-input"
        value="${opp}" oninput="updateBanner('oppScore', this.value)">

    <label class="banner-label" for="remaining">Your remaining available banners</label>
    <input type="number" inputmode="numeric" min="0" id="remaining" class="banner-input"
        value="${rem}" oninput="updateBanner('remaining', this.value)">

</div>

<div class="banner-readout">
    <div class="banner-readout-row">
        <span>Projected final (max)</span>
        <strong id="projectedFinal">${projected}</strong>
    </div>
    <div class="banner-readout-row">
        <span>Margin now</span>
        <strong id="bannerMargin" class="${margin > 0 ? "ahead" : margin < 0 ? "behind" : ""}">${marginText(margin)}</strong>
    </div>
</div>
`;
}

function updateBanner(field, value) {
    bannerData[field] = value === "" ? 0 : Number(value);
    localStorage.setItem("bannerData", JSON.stringify(bannerData));
    recomputeBannerReadouts();
}

function recomputeBannerReadouts() {
    const my  = Number(bannerData.myScore)  || 0;
    const opp = Number(bannerData.oppScore) || 0;
    const rem = Number(bannerData.remaining) || 0;

    const projected = my + rem;
    const margin = my - opp;

    const projectedEl = document.getElementById("projectedFinal");
    const marginEl = document.getElementById("bannerMargin");

    if (projectedEl) projectedEl.textContent = projected;
    if (marginEl) {
        marginEl.textContent = marginText(margin);
        marginEl.className = margin > 0 ? "ahead" : margin < 0 ? "behind" : "";
    }
}

// ─── ROSTER VIEW ─────────────────────────────────────────────────────────────

function renderRoster() {

    const allCharacters = getCharacterList();

    const filtered = allCharacters.filter(c =>
        c.name.toLowerCase().includes(rosterSearch.toLowerCase())
    );

    const ownedCount = allCharacters.filter(c =>
        ownedCharacters.includes(c.id)
    ).length;

    return `
<div class="round-card">
    <div class="round-title">👤 MY ROSTER</div>
    <div class="round-stat">${ownedCount} / ${allCharacters.length} characters owned</div>
    <button class="reset-button" onclick="clearRoster()" style="background:#555;">
        Clear Roster
    </button>
</div>

<input
    type="text"
    class="search-box"
    placeholder="Search characters..."
    value="${rosterSearch}"
    oninput="updateRosterSearch(this.value)"
>

<div class="roster-list">
    ${filtered.map(c => {
        const owned = ownedCharacters.includes(c.id);
        return `
<div class="roster-row ${owned ? "owned" : ""}" onclick="toggleOwned('${c.id}')">
    <span class="roster-name">${c.name}</span>
    <span class="roster-status">${owned ? "✅" : "➕"}</span>
</div>
`;
    }).join("")}
</div>
`;
}

function updateRosterSearch(value) {
    rosterSearch = value;
    const app = document.getElementById("app");
    const rosterList = app.querySelector(".roster-list");
    if (!rosterList) return;

    const allCharacters = getCharacterList();
    const filtered = allCharacters.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase())
    );

    rosterList.innerHTML = filtered.map(c => {
        const owned = ownedCharacters.includes(c.id);
        return `
<div class="roster-row ${owned ? "owned" : ""}" onclick="toggleOwned('${c.id}')">
    <span class="roster-name">${c.name}</span>
    <span class="roster-status">${owned ? "✅" : "➕"}</span>
</div>
`;
    }).join("");
}

function toggleOwned(characterId) {
    const idx = ownedCharacters.indexOf(characterId);
    if (idx === -1) {
        ownedCharacters.push(characterId);
    } else {
        ownedCharacters.splice(idx, 1);
    }
    localStorage.setItem("ownedCharacters", JSON.stringify(ownedCharacters));
    updateRosterSearch(rosterSearch);
    updateRosterStat();
}

function updateRosterStat() {
    const stat = document.querySelector(".round-stat");
    if (!stat) return;
    const allCharacters = getCharacterList();
    const ownedCount = allCharacters.filter(c =>
        ownedCharacters.includes(c.id)
    ).length;
    stat.textContent = `${ownedCount} / ${allCharacters.length} characters owned`;
}

function clearRoster() {
    const confirmed = confirm("Clear all owned characters?");
    if (!confirmed) return;
    ownedCharacters = [];
    localStorage.removeItem("ownedCharacters");
    render();
}

// Start the app
loadData();
