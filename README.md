# OfflineAid — Zero-Dependency Emergency Assistant

> **Tagline:** "Emergency help when the internet is not available."

OfflineAid is a privacy-first, offline-first emergency information and preparedness assistant built for the **72-Hour Zero Dependency Hackathon**. It empowers users to access life-saving first-aid guides, disaster checklists, emergency contacts, and personal medical information on their computer or mobile browser—**with zero internet connection and zero external dependencies**.

---

## 🛡️ ZERO DEPENDENCY VERIFICATION

OfflineAid strictly adheres to the **Zero-Dependency Rule**:

- **Python Packages:** `NONE` (Uses Python 3 Standard Library only)
- **JavaScript Packages:** `NONE` (100% Vanilla ES6 JavaScript)
- **CSS Frameworks:** `NONE` (Pure Vanilla CSS3 with CSS Custom Properties)
- **External CDNs / Fonts:** `NONE` (System font stack & inline vector SVG icons)
- **External APIs / Databases:** `NONE` (Uses Python's built-in `sqlite3` & browser `localStorage`)
- **Network Requirement:** `NONE FOR CORE FUNCTIONALITY` (Runs 100% offline)

### Audit of Python Imports Used
Every single import in the codebase belongs to the standard library of Python 3:

```python
import sys
import os
import json
import time
import sqlite3
import mimetypes
import threading
import urllib.parse
import urllib.request
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import unittest
```

---

## 🌟 Key Application Features

1. **Emergency Dashboard:** Clean emergency interface featuring prominent `OFFLINE READY` status, privacy guarantees, system stats, and direct action shortcuts.
2. **Emergency Contacts Manager:** Save important emergency numbers locally with relationship details, notes, and direct `tel:` call support. Includes full search, add, edit, and delete capability.
3. **Offline First-Aid Reference:** Concise, step-by-step guidance for critical medical situations (Basic CPR, Severe Bleeding, Choking, Burns, Minor Cuts, Nosebleeds, Sprains, Fainting, Heat Exhaustion, Dehydration). Includes prominent medical disclaimers.
4. **Disaster Action Checklists:** Actionable emergency response checklists for Earthquakes, Floods, Fires, Severe Storms, Power Outages, and Evacuations with visual completion progress tracking.
5. **Personal Emergency Information (ICE):** Store vital medical details (Blood group, severe allergies, ICE contacts, current medications, conditions, document locations) strictly on your local device.
6. **Go-Bag Preparedness Checklist:** Track essential supplies (Water, Food, First-Aid Kit, Flashlights, Batteries, Whistle, Power Banks, Cash) with real-time percentage readiness calculation.
7. **Quick Emergency Mode:** High-contrast, single-tap emergency view featuring enlarged text, direct telephone buttons, CPR/Bleeding shortcuts, and vital medical summary for rapid high-stress access.
8. **Global Offline Search:** Instant real-time search across contacts, first-aid topics, disaster checklists, and preparedness items without any external search API.
9. **Local Data Backup & Restore:** Export your emergency data to a JSON backup file or restore from previous backup files locally.
10. **Data Privacy & Reset:** Clear "Delete All My Data" functionality with confirmation modals.

---

## 🏗️ Technical Architecture

OfflineAid is designed with a lightweight dual-resilience architecture:

```
OfflineAid/
│
├── server.py             # Custom HTTP REST API & static server (http.server)
├── database.py           # Thread-safe SQLite3 manager & seed loader (sqlite3)
├── data/
│   └── seed_data.json    # Initial emergency seed data (CPR, checklists, guides)
├── static/
│   ├── index.html        # SPA markup with semantic HTML5 & inline SVG icons
│   ├── style.css         # Emergency-focused CSS3 theme & high-contrast mode
│   └── app.js            # Vanilla JS SPA router, API client & LocalStorage fallback
├── tests/
│   └── test_app.py       # Automated unit tests using standard library unittest
└── README.md             # Project documentation & audit report
```

### Dual-Layer Offline Persistence
1. **Primary Layer:** Local SQLite database (`offlineaid.db`) managed via Python `server.py` endpoints.
2. **Client Fallback Layer:** Client-side `localStorage` mirroring in `app.js`. If the Python server is ever stopped or the file is opened directly as a static document (`file://`), OfflineAid seamlessly falls back to browser storage, ensuring critical information remains 100% accessible.

---

## 🔒 Privacy & Security Approach

- **Strict Local Execution:** The Python HTTP server binds strictly to `127.0.0.1` (localhost).
- **Zero Telemetry:** No analytics, tracking, advertising, external logging, or network pings exist in the application.
- **Sanitized Inputs:** All dynamic user content rendered in the UI is safely HTML-escaped to prevent script injection. No `eval()` is used anywhere.
- **Privacy Reassurance:** Clear privacy notices inform the user: *"Your emergency information stays on this device."*

---

## 🚀 How to Run

Running OfflineAid requires **only Python 3**. No setup tools, package managers, or installation commands are needed!

### 1. Launch the Application Server
Open your terminal in the project directory and run:

```bash
python server.py
```

### 2. Open in Browser
Open your web browser and navigate to:

```
http://127.0.0.1:8000
```

---

## 🧪 How to Run Automated Tests

To run the full suite of unit tests using Python's standard library `unittest`:

```bash
python -m unittest tests/test_app.py
```

All tests execute in-memory and in background threads without modifying external state.

---

## ⏱️ 3-5 Minute Hackathon Judging Demo Flow

Follow this sequence to showcase the full power of OfflineAid to judges:

1. **Launch App:** Run `python server.py` and open `http://127.0.0.1:8000`.
2. **Observe Offline Ready Badge:** Point out the green pulsing `OFFLINE READY` indicator and privacy promise.
3. **Add Emergency Contact:** Click **Emergency Contacts** &rarr; **Add Contact** (Name: "Dr. Smith", Phone: "555-0199"). Notice instant local persistence.
4. **Update Medical Profile:** Go to **My Info (ICE)**, enter Blood Group `O+` and Allergy `Penicillin`. Save data.
5. **Interactive Checklists:** Go to **Disaster Checklists** &rarr; **Earthquake**, check off 3 items, and observe the progress bar update to `38%`.
6. **Activate Quick Emergency Mode:** Click the red **Quick Emergency** button in the header. Show the high-contrast view with large touch targets, telephone links, and medical card summary.
7. **Simulate Total Internet Disconnection:** Disable your computer's Wi-Fi / Ethernet adapter.
8. **Refresh & Test Offline:** Refresh the browser page. Search for `"CPR"` in the global search bar, open the **First-Aid CPR Guide**, and show that all steps and guidance load instantly without internet!
9. **Export Local Backup:** Go to **Export / Backup** and click **Download JSON Backup**. Point out that all data was packaged into a local JSON file without touching any cloud server.

---

## 🔮 Future Improvements

- **PWA Service Worker:** Add standard `sw.js` for one-click installation on mobile home screens.
- **Multi-Language Emergency Packs:** Pre-bundle translated emergency first-aid terms (Spanish, French, Hindi, Chinese) in standard JSON format.
- **Web Bluetooth Emergency Beacon:** Allow local device-to-device peer signaling over Web Bluetooth API during disaster blackouts.

---

## 📄 License
Open source emergency project created for the 72-Hour Zero Dependency Hackathon. Free to use and distribute offline.
