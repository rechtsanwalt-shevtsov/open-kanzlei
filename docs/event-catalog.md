# OpenKanzlei Event-Katalog

Stand: Juni 2026

Dieses Dokument beschreibt die öffentliche Event-Schnittstelle der Plattform.
Event-Typen sind Teil der Plattform-API und werden mit derselben Sorgfalt gepflegt wie REST-Endpunkte.

## Konventionen

### Benennung

Events folgen dem Muster `entity.action` in **Vergangenheitsform**:

- `created`, `updated`, `deleted`, `archived`, `activated`, `deactivated`, `completed`

Events beschreiben etwas, das **bereits passiert ist**.

### Sichtbarkeit

| Kategorie | Beschreibung |
|-----------|--------------|
| **Public** | Dürfen von Apps und Webhooks abonniert werden |
| **Internal** | Nur für interne Plattformprozesse; Apps konsumieren diese nicht |

### Payload-Prinzip

Events enthalten **keine Fachdaten oder Klartextinhalte** — nur Referenzen (IDs).
Apps laden Details über die entsprechende REST API nach.

### Versionierung

Event-Namen bleiben stabil. Schema-Änderungen erfolgen über `schema_version` im Payload, nicht über neue Event-Namen.

### Envelope (Webhook / externe Konsumenten)

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "case_model.created",
  "schema_version": 1,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "occurred_at": "2026-06-02T12:00:00.000Z",
  "actor_user_id": "550e8400-e29b-41d4-a716-446655440002",
  "data": {
    "case_model_id": "550e8400-e29b-41d4-a716-446655440003"
  }
}
```

`aggregate_type` und `aggregate_id` werden intern in der Datenbank gespeichert, erscheinen aber **nicht** im externen Envelope.

### Persistenz (intern)

Tabelle `events.domain_events`:

| Feld | Beschreibung |
|------|--------------|
| `id` | Event-ID (`event_id` im Envelope) |
| `event_type` | Event-Typ (`type` im Envelope) |
| `schema_version` | Payload-Schema-Version |
| `tenant_id` | Mandant |
| `occurred_at` | Zeitpunkt des Eintretens |
| `actor_user_id` | Auslösender Benutzer (nullable) |
| `visibility` | `public` oder `internal` |
| `payload` | JSONB mit `schema_version`, `actor_user_id`, `data` |
| `aggregate_type` | Internes Routing (nicht im Webhook) |
| `aggregate_id` | Internes Routing (nicht im Webhook) |

---

## Public Events (MVP)

### tenant.registered

| | |
|---|---|
| **Beschreibung** | Ein neuer Mandant wurde registriert. Deckt auch die Initialinstallation der Default-Apps ab (ohne separate `app.installed`-Events). |
| **Entsteht bei** | `POST /v1/auth/register` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:** `{}`

---

### tenant_profile.updated

| | |
|---|---|
| **Beschreibung** | Das Mandantenprofil wurde geändert (Firmenname, Sprache, Einstellungen, UI-Theme). |
| **Entsteht bei** | `PATCH /v1/tenant/profile`, `PATCH /v1/tenant/ui-preferences` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:** `{}`

---

### user.created

| | |
|---|---|
| **Beschreibung** | Ein neuer Benutzer wurde im Mandanten angelegt. |
| **Entsteht bei** | `POST /v1/tenant/users` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `user_id`

---

### user.updated

| | |
|---|---|
| **Beschreibung** | Ein Benutzer wurde geändert. |
| **Entsteht bei** | `PATCH /v1/tenant/users/{id}` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `user_id`

---

### app.installed

| | |
|---|---|
| **Beschreibung** | Eine App wurde explizit für einen Mandanten installiert. Wird **nicht** bei der Mandanten-Registrierung (Default-Apps) ausgelöst. |
| **Entsteht bei** | `PATCH /v1/tenant/apps/{appKey}` mit `status: active`, wenn die App zuvor nicht installiert war |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `app_key`

---

### app.activated

| | |
|---|---|
| **Beschreibung** | Eine zuvor deaktivierte App wurde wieder aktiviert. |
| **Entsteht bei** | `PATCH /v1/tenant/apps/{appKey}` mit `status: active`, wenn die App zuvor `inactive` war |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `app_key`

---

### app.deactivated

| | |
|---|---|
| **Beschreibung** | Eine App wurde deaktiviert. |
| **Entsteht bei** | `PATCH /v1/tenant/apps/{appKey}` mit `status: inactive`, wenn die App zuvor `active` war |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `app_key`

---

### app_settings.updated

| | |
|---|---|
| **Beschreibung** | App-Einstellungen wurden geändert. Enthält keine Setting-Werte. |
| **Entsteht bei** | `PATCH /v1/tenant/apps/{appKey}/settings`, `PATCH /v1/me/apps/{appKey}/settings` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `app_key`
- `scope` — `tenant` oder `user`
- `user_id` — nur bei `scope: user`

---

### case_model.created

| | |
|---|---|
| **Beschreibung** | Ein neues Case-Modell wurde erstellt. |
| **Entsteht bei** | `POST /v1/case-models` |
| **Public** | Ja |
| **schema_version** | 1 |
| **Details abrufen** | `GET /v1/case-models/{id}` |

**data:**

- `case_model_id`

---

### case_model.updated

| | |
|---|---|
| **Beschreibung** | Ein Case-Modell wurde geändert (ohne Archivierung). |
| **Entsteht bei** | `PATCH /v1/case-models/{id}` (außer reine Archivierung) |
| **Public** | Ja |
| **schema_version** | 1 |
| **Details abrufen** | `GET /v1/case-models/{id}` |

**data:**

- `case_model_id`

---

### case_model.archived

| | |
|---|---|
| **Beschreibung** | Ein Case-Modell wurde archiviert (`status` → `archived`). Löst **kein** zusätzliches `case_model.updated` aus. |
| **Entsteht bei** | `PATCH /v1/case-models/{id}` mit `status: archived` |
| **Public** | Ja |
| **schema_version** | 1 |
| **Details abrufen** | `GET /v1/case-models/{id}` |

**data:**

- `case_model_id`

---

### case_model.deleted

| | |
|---|---|
| **Beschreibung** | Ein Case-Modell wurde gelöscht. |
| **Entsteht bei** | `DELETE /v1/case-models/{id}` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `case_model_id`

---

### attribute_definition.created

| | |
|---|---|
| **Beschreibung** | Eine neue Attributdefinition wurde angelegt. |
| **Entsteht bei** | `POST /v1/case-models/{id}/attributes` |
| **Public** | Ja |
| **schema_version** | 1 |
| **Details abrufen** | Entsprechende GET-Attribute-Endpunkte |

**data:**

- `attribute_definition_id`

---

### attribute_definition.updated

| | |
|---|---|
| **Beschreibung** | Eine Attributdefinition wurde geändert. |
| **Entsteht bei** | `PATCH /v1/attribute-definitions/{id}` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `attribute_definition_id`

---

### attribute_definition.deleted

| | |
|---|---|
| **Beschreibung** | Eine Attributdefinition wurde gelöscht. |
| **Entsteht bei** | `DELETE /v1/attribute-definitions/{id}` |
| **Public** | Ja |
| **schema_version** | 1 |

**data:**

- `attribute_definition_id`

---

## Public Events (weitere — bereits implementiert)

Diese Events sind public und werden bereits ausgelöst. Sie werden in einer späteren Phase vollständig in die App-Subscription-API aufgenommen.

| Event | Beschreibung |
|-------|--------------|
| `case.created` / `.updated` / `.deleted` | Case-Instanz-Lebenszyklus |
| `task_model.created` / `.updated` / `.archived` / `.deleted` | Task-Modell-Lebenszyklus |
| `task.created` / `.updated` / `.deleted` | Task-Instanz-Lebenszyklus |

Instanz-Events können optional `changed_attribute_keys` in `data` enthalten (Schlüssel, keine Werte).

---

## Internal Events (reserviert)

Diese Event-Typen sind registriert, werden aber noch nicht ausgelöst.
Apps dürfen sie nicht abonnieren.

| Event | Beschreibung |
|-------|--------------|
| `auth.login_failed` | Fehlgeschlagener Login-Versuch |
| `session.created` | Neue Benutzersitzung |
| `cache.invalidated` | Cache-Eintrag invalidiert |

---

## TypeScript-Registry

Die kanonische Liste der Event-Typen liegt in:

`backend/src/foundation/events/event-types.ts`

Neue Event-Typen müssen dort registriert und in diesem Katalog dokumentiert werden.
