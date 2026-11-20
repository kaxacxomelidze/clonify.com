# Funnel tracking and Mixpanel

Every funnel event is stored in Clonyfy's own database (`events` table), which feeds the
**/admin** dashboard. When `MIXPANEL_TOKEN` is set, every event is also sent to Mixpanel.

## Events

The browser sends these events to `POST /api/track`, and the backend relays them:

| Event | When |
|---|---|
| `landing_view` | Landing page opened |
| `signup_view` | Sign-up page opened |
| `onboarding_started` | Guided onboarding (`/start`) opened by a free account |
| `onboarding_completed` | User finished customizing and clicked **Export** |
| `paywall_viewed` | Paywall shown (`source` = `onboarding_export`, `editor_export`, …) |
| `purchase_view` | Checkout page opened |
| `checkout_started` | Whop checkout created for a plan (`plan`, `interval`, `source`), or the exit offer |

The server records these events itself, so they cannot be faked or double counted:

| Event | When |
|---|---|
| `signup_completed` | Account created: email (`method: email`), Google or GitHub |
| `purchase_completed` | Whop confirmed the first payment of a plan (`plan`, `interval`, `amount`, `offer`), or the add-on (`product: addon_clones15`) |
| `subscription_renewed` | Whop confirmed a renewal payment |
| `churn` | Subscriber cancelled (in Clonyfy or on Whop); access runs to the period end |
| `churn_reverted` | Cancellation undone before the period ended |
| `subscription_ended` | Whop ended the membership (access removed) |

## Identity

- Before sign-up, events carry the browser's anonymous id.
- After sign-up, events carry the user id as `distinct_id`, plus `$device_id` (the anonymous
  id) and `$user_id`. With Mixpanel's Simplified ID Merge, the visitor's pre-signup and
  post-signup activity merges into one person.
- New accounts and new purchases also set the Mixpanel profile: name, email and plan.

## Setup

1. Create a Mixpanel project (US or EU data residency; the US API is used by default).
2. Project settings → copy the **Project Token**, then set `MIXPANEL_TOKEN=<token>` in
   `backend/.env.production`.
3. In the project settings, make sure **Simplified ID Merge** is on (the default for new
   projects).
4. Restart the backend.
5. Create a Funnel report with these steps, in order:
   1. `landing_view`
   2. `signup_view`
   3. `signup_completed`
   4. `onboarding_started`
   5. `onboarding_completed`
   6. `paywall_viewed`
   7. `checkout_started`
   8. `purchase_completed`

   For churn, add an Insights report on `churn`, broken down by `plan`.

The token is a project identifier, not a secret, but keep it in the env file rather than in
code.
