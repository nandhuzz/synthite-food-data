# Food Data — Regulatory Compliance Tracker

> Offline-first Windows desktop app for managing food regulatory data across countries, materials, and regulatory frameworks.

Built with **Wails v2 · React · SQLite** — no cloud, no accounts, no internet required.

---

## What It Does

Food Data tracks regulatory compliance information for food materials across different countries and regulatory frameworks. Each record stores contaminant limits (Aflatoxin, Ochratoxin, Heavy Metals, Pesticides, PAH, PCBs, Mercury, Cadmium, Arsenic), labelling and packaging requirements, phytosanitary requirements, declaration codes, and source links — all in a local SQLite database.

Key capabilities:

- Full CRUD on item data with a composite primary key (Item ID + Country + Material + Regulation Type)
- Manage lookup tables for Countries, Material Groups, Declarations, and Regulations
- Contaminant fields store structured JSON `{ "value": "4.0 µg/kg", "link": "https://..." }` for traceable limits
- Live search and multi-filter (country / material / regulation)
- View modal with clickable source links and one-click copy per field
- Print-ready record layout
- Duplicate records across countries or regulation types
- Auto-seeds sample data on first launch

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Go](https://go.dev/dl/) | 1.21+ | Backend runtime |
| [Node.js](https://nodejs.org) | 18+ | Frontend build |
| [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) | any | Required for CGO / SQLite on Windows |
| [Wails CLI](https://wails.io) | v2.9+ | Desktop app framework |

Install Wails CLI:
```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor   # verify everything is set up
```

---

## Setup

### 1. Clone
```powershell
git clone https://github.com/nandhuzz/synthite-food-data
cd synthite-food-data
```

### 2. Install dependencies
```powershell
go mod tidy

cd frontend
npm install
cd ..
```

### 3. Development (hot reload)
```powershell
# Delete the committed wailsjs stub so Wails regenerates it
del frontend\wailsjs\go\main\App.js

wails dev
```

### 4. Build `.exe`
```powershell
wails build
# Output: build\bin\synthite-food-data.exe
```

On first launch the app creates `regulations.db` next to the executable and seeds it with sample countries, material groups, declarations, and regulation types.

---

## Project Structure

```
synthite-food-data/
├── main.go                    Wails entry point, window config
├── app.go                     App struct, DB init, seed, all CRUD bindings
├── go.mod
├── index.html                 Project landing page
├── README.md
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── wailsjs/
    │   └── go/main/App.js     Auto-generated Go→JS bindings (stub committed)
    └── src/
        ├── main.jsx
        ├── App.jsx            Full UI — all tabs, modals, CRUD logic
        └── App.css
```

---

## Database Schema

Five tables. Foreign keys enforced via SQLite pragma.

```
item_data          — main table, composite PK
  itemid           INTEGER  ─┐
  country          INTEGER  ─┤ composite PRIMARY KEY
  materialName     INTEGER  ─┤ + UNIQUE constraint
  regulationtype   INTEGER  ─┘
  declaration      INTEGER
  labellingReq     TEXT     JSON { value, link }
  packagingReq     TEXT     JSON { value, link }
  phytoSanitaryReq TEXT     JSON { value, link }
  solvent          TEXT     JSON { value, link }
  aflatoxin        TEXT     JSON { value, link }
  aflatoxinB1      TEXT     JSON { value, link }
  aflatoxinSum     TEXT     JSON { value, link }
  ochratoxin       TEXT     JSON { value, link }
  ochratoxinA      TEXT     JSON { value, link }
  heavyMetal       TEXT     JSON { value, link }
  pesticides       TEXT     JSON { value, link }
  pah              TEXT     JSON { value, link }
  pcbs             TEXT     JSON { value, link }
  mercury          TEXT     JSON { value, link }
  cadmium          TEXT     JSON { value, link }
  arsenic          TEXT     JSON { value, link }
  regulationLink   TEXT     plain URL
  website          TEXT     plain URL
  pahLink          TEXT     plain URL
  remarks          TEXT

country            id, name, code
material_group     id, name, code
declaration        id, code (int), description
regulation         id, name, description
```

JSON field shape:
```json
{ "value": "4.0 µg/kg", "link": "https://eur-lex.europa.eu/..." }
```

---

## Adding Real Data

To replace sample seed data, edit the slices in `seedOnce()` inside `app.go`. The function checks `COUNT(*)` per table — it only inserts if the table is empty, so changes only take effect on a fresh database.

---

## Developer

**Anandhu N V**
GitHub: [github.com/nandhuzz](https://github.com/nandhuzz)
Repository: [github.com/nandhuzz/synthite-food-data](https://github.com/nandhuzz/synthite-food-data)
