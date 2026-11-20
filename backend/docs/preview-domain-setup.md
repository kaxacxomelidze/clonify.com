# Preview domain (preview.clonyfy.com)

## Why previews need it

A clone's preview only behaves like the original site when the original site's JavaScript
runs: carousels, dropdown menus, animated demos, WebGL gradients (Stripe), text effects.

That JavaScript comes from a site we don't control, so it must never run on clonyfy.com,
where it could read a signed-in user's session. It runs on a separate origin with no
logins: `PREVIEW_ORIGIN`.

Without `PREVIEW_ORIGIN`, production serves every preview from clonyfy.com, so the backend
switches the site's JavaScript off. The visible results:

- carousel arrows do nothing, and the toast "This button's action is not cloned yet" appears;
- dropdown menus open as narrow, unstyled lists;
- animated sections and WebGL backgrounds are frozen, empty or misplaced.

The backend now prints a `[WARN] PREVIEW_ORIGIN is not set …` line at startup when it runs
in this mode.

## Setup (one time, about 15 minutes plus DNS propagation)

1. **DNS** (GoDaddy → clonyfy.com → DNS): add an `A` record. Name: `preview`. Value: the
   server IP, the same value as the `@` record (currently `49.12.145.162`).
2. Wait until it resolves:

   ```bash
   nslookup preview.clonyfy.com   # must print the server IP
   ```

3. **nginx**: `nginx/default.conf` already contains the `preview.clonyfy.com` server
   blocks. On the server, deploy the latest file and reload:

   ```bash
   docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
   ```

4. **Certificate**: add `preview.clonyfy.com` to the existing Let's Encrypt certificate,
   using the same webroot as before. Run it from the project folder:

   ```bash
   docker run --rm \
     -v "$PWD/certbot/conf:/etc/letsencrypt" \
     -v "$PWD/certbot/www:/var/www/certbot" \
     certbot/certbot certonly --webroot -w /var/www/certbot \
     -d clonyfy.com -d www.clonyfy.com -d preview.clonyfy.com --expand
   docker compose exec nginx nginx -s reload
   ```

5. **Backend**: add this line to `backend/.env.production`, then recreate the container so
   it picks up the setting:

   ```env
   PREVIEW_ORIGIN=https://preview.clonyfy.com
   ```

   ```bash
   docker compose up -d --build backend
   ```

## Check

- The backend log no longer shows the `PREVIEW_ORIGIN is not set` warning.
- Open any clone and click **Open preview**. The address starts with
  `https://preview.clonyfy.com/api/page?` and ends with `&scripts=1`.
- On a lovable.dev clone, the customer-story arrows switch stories and the "Solutions"
  menu opens as on the real site.
- On a stripe.com clone, the "Products" menu opens as Stripe's full panel, and the hero
  shows its "Get started" buttons and moving logo row.

Existing clones benefit immediately, so nothing needs to be cloned again.
