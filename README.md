# AptWatch

a chrome extension that pulls unit listings off apartment availability pages. early MVP, not meant to be serious!

## How to use it

chrome://extensions → Developer mode → Load unpacked → this folder  
click AptWatch → add a name and URL → Analyze  
open an availability page, then Analyze again to refresh units  
Dashboard in the popup opens the website

### Backend

```
npm run dev
```

## CI

GitHub Actions — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

More setup (backend, dashboard, monitoring): [`docs/`](docs/)
