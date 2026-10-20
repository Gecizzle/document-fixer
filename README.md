# Document Fixer

Starter MVP: JPG, PNG, WebP conversion, resizing, quality adjustment and Stripe-gated download.

## Render deployment
Create a Node web service from this repository. Build command: `npm install`; start command: `npm start`. Set `STRIPE_SECRET_KEY` and `BASE_URL` (the public HTTPS Render URL) in Render environment variables. Do not commit secrets.

**Important:** This is an early prototype. In-memory jobs disappear on restarts and cannot be shared across multiple instances. Do not accept real payments until persistence, reliable post-payment downloads, refund/retry handling, privacy policy, abuse limits, and end-to-end testing are implemented. PDF support is not implemented in this version.
