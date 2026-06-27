# OpenKanzlei

Work-Context-Plattform für juristische Wissensarbeit — API-first, multitenantfähig, eventorientiert.

Leitprinzip: **Work Context enables Work** (nicht: Workflow defines Work).

## Dokumentation

Architektur und Implementierungsplan: [`Konzept.txt`](./Konzept.txt)

## Voraussetzungen

- [Docker](https://www.docker.com/) und Docker Compose
- [Node.js](https://nodejs.org/) 20+ (für Backend)

## Schnellstart

```bash
# Datenbank starten
docker compose up -d

# Abhängigkeiten und Migrationen (einmalig)
cp .env.example .env
cd backend && npm install && npm run migrate
cd ../frontend/react-app && npm install

# Backend + Frontend gemeinsam starten/neu starten (Projektroot)
./dev.sh
```

`./dev.sh` baut das Backend, beendet alte Prozesse auf Port 3000/5173 und startet API sowie UI.  
Weitere Befehle: `./dev.sh stop`, `./dev.sh build`, `./dev.sh restart`

```bash
# Optional: Outbox-Dispatcher (eigenes Terminal)
cd backend && npm run worker:events
```

### API testen (Schritt 2)

```bash
# Tenant registrieren
curl -s -c cookies.txt -X POST http://localhost:3000/v1/auth/register-tenant \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: de' \
  -d '{
    "firm_name": "Demo Kanzlei",
    "admin_username": "admin",
    "admin_email": "admin@demo.local",
    "admin_password": "securepass123",
    "default_language": "de"
  }'

# Aktueller Benutzer
curl -s -b cookies.txt http://localhost:3000/v1/auth/me

# Tenant-Profil
curl -s -b cookies.txt http://localhost:3000/v1/tenant/profile
```

## Legal Work API (Schritt 4)

Alle Endpunkte erfordern eine Session (Cookie nach Login).

**Modelle:** `GET/POST /v1/case-models`, Attributdefinitionen unter `…/attributes`

**Instanzen (lazy):** `POST /v1/cases` erzeugt Case-Instanzen

**Attribute:** Definitionen nur auf Modellen; Werte auf Instanzen im Feld `attributes`  
(z. B. `"title": "Müller gegen Mayer"` — kein title als DB-Spalte).

Beispiel nach Login:

```bash
# Case-Modell + Attribut "title"
curl -s -b cookies.txt -X POST http://localhost:3000/v1/case-models \
  -H 'Content-Type: application/json' \
  -d '{"key":"fallakte","translations":{"de":"Fallakte"}}'

curl -s -b cookies.txt -X POST http://localhost:3000/v1/case-models/{MODEL_ID}/attributes \
  -H 'Content-Type: application/json' \
  -d '{"key":"title","data_type":"text","encryption_mode":"zero_knowledge","translations":{"de":"Titel"}}'

# Case-Instanz (lazy)
curl -s -b cookies.txt -X POST http://localhost:3000/v1/cases \
  -H 'Content-Type: application/json' \
  -d '{"case_model_id":"{MODEL_ID}","attributes":{"title":"Müller gegen Mayer"}}'
```

OpenAPI: `openapi/openapi.yaml` (Tag `LegalWork`)

## Apps

First-Party-Apps liegen unter `apps/<app-key>/` (Manifest + Frontend). Beispiel: **case-model-designer** — Case-Modelle und Attributdefinitionen.

- UI: `/apps/case-model-designer` (Team „Administratoren“, Tenant muss App aktiv haben)
- Admin-Katalog: `/admin/apps` — alle serverbekannten Apps, Aktivieren/Deaktivieren
- APIs: Tag `Apps` (`GET /v1/apps`, `GET /v1/tenant/apps`, Settings, Manifest)
- Registry: Server scannt `apps/` beim Start (`APPS_PATH`)
- App-Assets: `GET /app-assets/{appKey}/…` aus `apps/<key>/frontend/dist/`

Build App-Chunks: `cd frontend/react-app && npm run build:apps`

Task-/Instrument-Modelle: weiterhin unter `/admin/models`

Nach `git pull`: `cd backend && npm run migrate`

## Benutzer und Teams

Rechte werden über **Teams** vergeben (kein separates Rollen-System). Standard-Teams pro Tenant:

| Key | Standardname | Bedeutung |
|-----|--------------|-----------|
| `admin` | Administratoren | Vollzugriff auf Administration (nicht umbenennbar) |
| `regular` | Benutzer | Basiszugriff ohne Admin-Rechte (umbenennbar) |

- Jeder Benutzer gehört mindestens einem Team an
- Nur der erste Administrator bei Tenant-Anlage wird zusätzlich dem Team `regular` zugewiesen
- Verwaltung: `/admin/users` (Teams und Benutzer anlegen, bearbeiten, löschen — nur Administratoren)
- Team „Administratoren“ kann nicht gelöscht werden; andere Teams nur ohne zugewiesene Benutzer
- App-Zugriff: pro Team aktivierbar unter `/admin/apps` (nur Administratoren); Sidebar zeigt Apps, die für mindestens ein Team des Benutzers aktiv sind
- App-Attribute: Apps deklarieren `requires_attributes` (Shared Registry) und `provides_attributes` (app-spezifisch) im Manifest — siehe Konzept.txt §7 und §18.2b

## Frontend (Schritt 3)

```bash
# Terminal 1: Backend (Projektroot → backend)
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend/react-app
npm install
npm run dev
# → http://localhost:5173
```

Der Vite-Dev-Server leitet API-Anfragen an Port 3000 weiter (Session-Cookies).

OpenAPI-Typen neu generieren nach Vertragsänderung:

```bash
cd frontend/react-app && npm run generate:api
```

## Projektstruktur

```
openapi/          # OpenAPI-Vertrag (API-first)
backend/          # Node.js / TypeScript
frontend/react-app/  # React + Vite
```

## Lizenz

Apache License 2.0 — siehe [LICENSE](./LICENSE).
