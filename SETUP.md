# Aqua-Checkin — Firebase / HTML-JS rebuild

A dependency-free HTML + JavaScript rebuild of the Aqua-Checkin emergency
roll-call app. All data lives in **Firebase Firestore** instead of Google Sheets.

## What it does

- **Home** — search the employee/guest directory by first name, last name, or
  department, then tap **IN** or **OUT** to record a check-in. A live badge shows
  each person's current status for today.
- **Add Guest** — add someone not in the directory so they can be checked in.
- **Roll Call Report** — everyone currently checked **in** today, with a
  Share/Print button.
- **Evacuation route** maps for the first and second floors.

## Where the data lives (two Firebase projects)

The employee directory is **read live** from the **AQUALocator** project — this
app never keeps its own copy of the roster and never writes to AQUALocator. It
writes only its own data (check-ins and in-app guests) to the **aquacheckinapp**
project.

| Data | Project | Access | Collection |
|------|---------|--------|------------|
| Employee directory | `aqualocator-23714` | read-only | `artifacts/default-app-id/public/data/employees` |
| Check-ins | `aquacheckinapp` | read/write | `checkins` |
| In-app guests | `aquacheckinapp` | read/write | `guests` |

The on-screen directory is the AQUALocator employees **merged with** any guests
added in this app. Because the roster is read live, whenever AQUALocator is
updated the check-in app reflects it automatically — no re-seeding.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell / all screens |
| `styles.css` | Styling |
| `app.js` | All logic + two-project Firestore data layer (ES module) |
| `firebase-config.js` | This app's config **and** the AQUALocator (read-only) config |
| `firestore.rules` | Security rules for the **aquacheckinapp** project |
| `img/` | Logo + floor evacuation maps |

## One-time Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), open
   **aquacheckinapp**.
2. **Build → Firestore Database → Create database** (start in production mode).
3. Open the **Rules** tab, paste the contents of `firestore.rules`, and
   **Publish**.
4. That's it — `firebase-config.js` already has both sets of credentials.
   (No setup is needed on AQUALocator; it's read-only and already public-read.)

## Data model

**`checkins`** (append-only log, one doc per IN/OUT tap — in `aquacheckinapp`)
```
{ first, last, dept, status: "in" | "out", date: "YYYY-MM-DD", time, ts }
```

**`guests`** (add-only, people not in the directory — in `aquacheckinapp`)
```
{ first, last, dept, title: "Guest", ext, email }
```

The report and status badges are computed from the newest check-in per person
for the current day, so the log stays simple and audit-friendly.

## No seeding

There is no seed file and no `employees` collection in this project — the roster
comes straight from AQUALocator at runtime. You can safely delete any old
`employees` collection from `aquacheckinapp`; it is no longer used.

## Running it locally

Because it uses ES modules and `fetch`, open it from a web server (not
`file://`). **Use the included `serve.py`, not `python -m http.server`:**

```bash
# from the repository root (where index.html lives)
python serve.py           # then visit http://localhost:8000/
```

> ⚠️ **Do not use `python -m http.server` on Windows.** It reads the `.js` MIME
> type from the Windows registry, which is usually `text/html`/`text/plain`, so
> the browser refuses to run the module scripts with:
> *"Failed to load module script: Expected a JavaScript-or-Wasm module script but
> the server responded with a MIME type of 'text/plain'."*
> `serve.py` forces the correct `text/javascript` type and avoids this.
> (Any other proper static server also works, e.g. `npx serve` or VS Code Live Server.)

## Deploy options

- **Firebase Hosting** (recommended — correct MIME types automatically):
  ```bash
  # from the repository root
  firebase deploy          # uses the included firebase.json
  ```
  `firebase.json` also deploys `firestore.rules`. Run `firebase login` and
  `firebase use aquacheckinapp` first if you haven't.
- **GitHub Pages** — this app now lives at the site root, so it is served
  directly. GitHub Pages serves `.js` with the correct MIME type, so no extra
  config is
  needed there.

## Demo mode

If `firebase-config.js` still contained placeholder values, the app would fall
back to a local **demo mode** (check-ins and guests stored only in the current
browser via `localStorage`; the directory is empty in this mode) so it stays
testable without Firebase. Since real credentials are now in place, it talks to
Firestore.
