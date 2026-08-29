# AptWatch

a chrome extension that pulls unit listings off apartment availability pages. early MVP, not meant to be serious!

## How to use it

chrome://extensions → Developer mode → Load unpacked → `extension/` folder  
click AptWatch → add a name and URL → Analyze  
open an availability page, then Analyze again to refresh units  
Dashboard in the popup opens the website

### Backend

One-time setup so the extension can start the backend when you open it:

```bash
npm run launcher:install
```

After that, opening the extension starts Postgres/API/dashboard automatically. You can also run `npm run launcher` manually, or `npm run dev` as before.

## CI

GitHub Actions — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

More setup (backend, dashboard, monitoring): [`docs/`](docs/)
