# OpenKanzlei

Work-Context-Plattform für juristische Wissensarbeit — API-first, multitenantfähig, eventorientiert.

Leitprinzip: **Work Context enables Work** (nicht: Workflow defines Work).

## Dokumentation

Architektur und Implementierungsplan: [`Konzept.txt`](./Konzept.txt)

## Voraussetzungen

- [Docker](https://www.docker.com/) und Docker Compose
- [Node.js](https://nodejs.org/) 20+ (für Backend)

## Schnellstart (Schritt 1)

```bash
# Datenbank starten
docker compose up -d

# Abhängigkeiten und Migrationen
cp .env.example .env
cd backend && npm install && npm run migrate

# Health-Check
npm run dev
# GET http://localhost:3000/health
```

## Projektstruktur

```
openapi/          # OpenAPI-Vertrag (API-first)
backend/          # Node.js / TypeScript
frontend/         # React (ab Schritt 3)
```

## Lizenz

Apache License 2.0 — siehe [LICENSE](./LICENSE).
