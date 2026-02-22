# Fixing R2 "Failed to Fetch" (CORS Issue)

The error `TypeError: Failed to fetch` when uploading files to Cloudflare R2 almost always means that your R2 bucket is blocking requests from your web browser (Cross-Origin Resource Sharing or CORS).

Since you are running the app on `http://localhost:5173` (or similar), R2 needs to be told that this address is allowed to upload files.

## Step-by-Step Fix

1.  **Log in to Cloudflare Dashboard**.
2.  Go to **R2** from the sidebar.
3.  Click on your bucket name (`church-assets`).
4.  Go to the **Settings** tab.
5.  Scroll down to the **CORS Policy** section.
6.  Click **Add CORS Policy** (or Edit if one exists).
7.  Paste the following JSON configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

8.  Click **Save**.

## Why this happens?
Browser security prevents web pages from making requests to a different domain (like `r2.cloudflarestorage.com`) unless that domain explicitly says "It's okay, I know `localhost`". By adding this policy, you are telling R2 to accept file uploads from your local development environment.

## Still having issues?
If the error persists after adding the CORS policy:
1.  **Check your internet connection**: Ensure you can reach `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
2.  **Verify Account ID**: Double-check `VITE_R2_ACCOUNT_ID` in `.env.local`.
3.  **VPN/Firewall**: Sometimes corporate VPNs block R2 endpoints.
