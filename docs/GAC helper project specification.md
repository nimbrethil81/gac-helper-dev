# SWGOH GAC Helper — Project Specification

A mobile-first Progressive Web App that helps players make faster, better Grand Arena Championship (GAC) decisions in *Star Wars: Galaxy of Heroes*.

---

## Contents

1. [Overview](#1-overview)
   - 1.1 [Design Philosophy](#11-design-philosophy)
   - 1.2 [Target User](#12-target-user)
2. [Design Principles](#2-design-principles)
3. [Architecture](#3-architecture)
   - 3.1 [Frontend](#31-frontend)
   - 3.2 [Backend](#32-backend)
   - 3.3 [Data Flow](#33-data-flow)
   - 3.4 [State & Persistence](#34-state--persistence)
4. [Data Model](#4-data-model)
   - 4.1 [Sheet Structure](#41-sheet-structure)
   - 4.2 [Identifier Standards](#42-identifier-standards)
5. [API Contract](#5-api-contract)
6. [Current Features](#6-current-features)
   - 6.1 [Counter Lookup](#61-counter-lookup)
   - 6.2 [Used Team Tracking](#62-used-team-tracking)
   - 6.3 [Banner Tracking](#63-banner-tracking)
   - 6.4 [Roster Management](#64-roster-management)
   - 6.5 [Counter Status](#65-counter-status)
7. [Roster Model](#7-roster-model)
8. [Roadmap](#8-roadmap)
9. [Success Criteria](#9-success-criteria)
10. [Future Vision](#10-future-vision)

---

## 1. Overview

SWGOH GAC Helper is a lightweight companion app for use during live GAC rounds. It provides a fast counter-lookup experience focused on practical, in-the-moment decision-making, and is evolving incrementally from a simple lookup tool into a personal GAC planning assistant.

The app is designed to answer, within seconds: *which counters beat this enemy team, which are still available to me, and which have I already used?*

It deliberately models **strategic team identities** rather than exact squad compositions. The guiding question is always "can the player reasonably field this counter?" — not "what is the perfect mod-and-relic squad for this specific matchup?"

The app currently models **character counters only**. Fleet combat is a genuine GAC feature — one of the four territories is always a fleet battle — but is deliberately out of scope at this stage and is the subject of a dedicated roadmap milestone (v2.5, see [§8](#8-roadmap)). Where this document refers to "counters" without qualification, it means character counters.

The long-term direction is a roster-aware GAC strategist that can recommend attack order, allocate counters efficiently, optimise banners, and avoid conflicts — while always prioritising simplicity and speed over replicating the full depth of sites like SWGOH.gg.

### 1.1 Design Philosophy

* **Fast** — find a counter within seconds, mid-match.
* **Mobile-first** — built for phones and Home Screen PWA installation.
* **Maintainable** — counter data is editable in Google Sheets without touching application code.
* **Incremental** — features ship in stages; the app stays functional throughout.
* **Identity over composition** — counters represent team identities, not squad variations.
* **Cache-first** — local data is the working store; the network is a refresh mechanism, never a dependency.

### 1.2 Target User

* Intermediate to advanced SWGOH players.
* Regular GAC participants who want to maximise banners and efficiency.
* Players who maintain their own counter knowledge and roster data.

---

## 2. Design Principles

**Mobile first.** The interface is optimised for iPhone and Android, and for installation as a standalone Home Screen PWA. Navigation between top-level views uses a fixed bottom navigation bar.

**Fast.** Lookup is the critical path. A user should reach a counter list in as few taps as possible, with search and mode selection always to hand.

**Maintainable.** All game data lives in Google Sheets. Adding counters, adjusting tiers, or editing notes requires no code change and no redeployment of the frontend.

**Incremental.** Each version delivers a self-contained, working improvement. The app is never left in a broken intermediate state between releases.

**Cache-first, network-second.** The app must be fully usable mid-GAC on poor venue wifi. It always renders from local state first and treats remote calls (roster import) as background refreshes that can fail silently without blocking the user.

---

## 3. Architecture

The app is a static frontend served from GitHub Pages, backed by a read-only JSON API built on Google Apps Script over Google Sheets. There is no server-side application code beyond the Apps Script endpoint, and no database other than the spreadsheet.

### 3.1 Frontend

Hosted on GitHub Pages.

* **index.html** — app shell; loads styles and scripts; registers the service worker.
* **styles.css** — theme, layout, responsive design, component styling.
* **app.js** — data loading, state management, rendering, counter lookup, used-team tracking, banner tracking, roster management, roster import, and availability calculation.
* **service-worker.js** — PWA offline shell.
* **manifest.json** — PWA metadata.

### 3.2 Backend

* **Google Sheets** — primary data store and single source of truth for all game data, including the `External_ID` (swgoh.gg base_id) mapping column.
* **Google Apps Script** — a `doGet` web app with a lightweight `action` router:
  * `action=data` (default) — reads the sheets and returns the consolidated counter/definition payload consumed by the frontend.
  * `action=roster&allyCode=…` — a thin server-side proxy that calls the SWGOH.gg player endpoint and returns base_ids only. This exists solely to clear the browser CORS barrier; it performs no mapping or business logic of its own.

The roster proxy is deliberately "dumb": it returns the player's owned `base_id`s and a sync timestamp, and the client performs all mapping and classification. This keeps the payload small (important for the poor-wifi scenario), keeps the sheet as the single source of truth for the ID mapping, and avoids re-reading the sheet on every sync.

### 3.3 Data Flow
