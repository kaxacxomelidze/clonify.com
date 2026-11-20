# Whop setup (payments)

Clonyfy sells through Whop. Each plan must be its **own Whop product**, because Whop allows
one membership per product: plans that share a product block upgrades. Set every product to
**hidden**, so it can only be bought from Clonyfy, where the buyer's account is known.

## 1. Products and prices

Create these products in Whop. Do it in sandbox first, then in production. The annual
prices are 45% off twelve months; the website shows them as a monthly price.

| Product | Variant | Billing | Price | Env var |
|---|---|---|---|---|
| Clonyfy Starter | Monthly | renewal, every 30 days | $17.99 | `WHOP_PLAN_STARTER_MONTHLY` |
| Clonyfy Starter | Yearly | renewal, every 365 days | $118.73 | `WHOP_PLAN_STARTER_ANNUAL` |
| Clonyfy Growth | Monthly | renewal, every 30 days | $26.99 | `WHOP_PLAN_GROWTH_MONTHLY` |
| Clonyfy Growth | Yearly | renewal, every 365 days | $178.13 | `WHOP_PLAN_GROWTH_ANNUAL` |
| Clonyfy Growth | Exit offer (hidden) | see below | $161.94 first year, then $178.13/yr | `WHOP_PLAN_GROWTH_DOWNSELL` |
| Clonyfy Pro | Monthly | renewal, every 30 days | $79.99 | `WHOP_PLAN_PRO_MONTHLY` |
| Clonyfy Pro | Yearly | renewal, every 365 days | $527.93 | `WHOP_PLAN_PRO_ANNUAL` |
| Extra Website Clones | One-time | one_time | $20.00 | `WHOP_PLAN_ADDON_CLONES15` |

If the top product is still called "Scale" in Whop, rename it to **Clonyfy Pro**: buyers see
Whop's product name on the checkout. The old `WHOP_PLAN_SCALE_*` env names still work.

### The exit offer

The X on the paywall shows this offer: "$161.94 billed today for the first year. Renews at
$178.13/year unless canceled."

For recurring variants, Whop charges the setup price **on top of** the first renewal unless a
free trial applies. To bill exactly $161.94 today, configure the variant like this:

- `initial_price` = 161.94
- `trial_period_days` = 365
- `renewal_price` = 178.13
- `billing_period` = 365

The backend refuses a second exit-offer purchase on the same account (`downsell_used`). The
offer only shows when `WHOP_PLAN_GROWTH_DOWNSELL` is set.

### Retired prices

If members still renew on old plan ids, map them so renewals keep working:
`WHOP_LEGACY_PLANS=plan_old1:starter,plan_old2:growth:annual`.

## 2. API key and webhook

1. Whop dashboard → Developer → create a company API key and set it as `WHOP_API_KEY`. The key
   needs these scopes:
   - checkout configurations (create);
   - memberships (read and cancel);
   - payments (read).
2. Developer → Webhooks → add `https://clonyfy.com/api/whop/webhook` and subscribe to:
   - `membership.activated`
   - `membership.deactivated`
   - `membership.cancel_at_period_end_changed`
   - `payment.succeeded`
   - `payment.failed`

   Copy the `ws_…` secret into `WHOP_WEBHOOK_SECRET`.
3. Optional: if the key was created on a newer Whop API version and payloads look different,
   set `WHOP_API_VERSION_DATE` to the version the code was written against. The webhook
   parser already accepts both field shapes, `plan.id` and `variant_id`.

Restart the API after changing env vars: `docker compose up -d --build backend`.

## 3. What happens on a purchase

1. The paywall or pricing page opens `/checkout`. The embedded Whop form is created by
   `POST /api/payments/whop/checkout`, which records a **pending** payment row.
2. Whop sends `payment.succeeded`. The row becomes **confirmed** and the plan is granted. The
   server records `purchase_completed` in the funnel and in Mixpanel.
3. The buyer is sent back to where they were (`returnPath`, e.g. `/start?step=unlocked…`). That
   page calls `POST /api/payments/whop/sync`, so access is granted even before the webhook
   arrives.

Webhooks are idempotent:
- A payment that is already confirmed is skipped.
- A payment that first failed and then succeeded on Whop's retry upgrades its existing row.
- The +15 clones add-on is credited exactly once.

The daily dunning job never downgrades a member that Whop still reports as active,
trialing or past_due. Whop ends access with `membership.deactivated`.

## 4. Test it end to end

1. In Whop sandbox (or production with a 100% promo code), buy Starter monthly from the
   onboarding paywall. Check that:
   - you land on "Export is unlocked";
   - Billing shows Starter;
   - Admin → Payments shows a confirmed row.
2. Buy the add-on on `/checkout`. Credits go up by 15, exactly once. Replay the webhook from
   Whop's dashboard: credits stay the same.
3. Close the paywall with X and buy the exit offer. You should be charged $161.94 and get the
   Growth plan on yearly billing. Try the offer again: it must be refused.
4. Cancel from Billing. Admin → Overview → "Churn (30 days)" goes up, and the user keeps
   access until the period ends.
