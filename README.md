# talk 2 strangers kek

## TODO

### Frontend

- **PWA support** — add `viewport-fit=cover` + `safe-area-inset` padding so Add-to-Home-Screen looks clean on iPhone (Dynamic Island / home indicator).
- **Auth: errorCallbackURL** — add to Google sign-in so OAuth errors route to the frontend instead of an auth 404.
- **Cloudflare: cache static frontend** — Cache Rule on apex; defer until frontend stable (cached HTML goes stale during dev).

### Backend

- **Cloudflare: CSAM scanning** — enable + NCMEC reporting once image uploads exist.
