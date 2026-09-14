# Alice (GH Pages)

Phone-friendly Alice list reader.

- **Public:** this static shell (`https://0xbn.github.io/alice/`)
- **Private:** Drive JSON under `03 Personal / Alice web /` (`brianvbn@gmail.com`)
- **Auth:** Google Sign-In (GIS) → Drive `readonly` → render open items

Same pattern as [workout](https://github.com/0xBN/workout) (Pages UI + Google data), but Drive `.json` instead of a Sheet.

Playbook: `life-ops/.agents/ALICE_PAGES_PLAN.md`

## Local

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. File:// will fail GIS / fetch.

## Config

| Constant | Where | Notes |
|----------|--------|--------|
| `CLIENT_ID` | `app.js` | Workout Web OAuth client (public) |
| `FILE_ID` | `app.js` | Drive file id for `alice-sample.json` (then live `alice.json`) |

No Alice data and no OAuth secrets in this repo.
