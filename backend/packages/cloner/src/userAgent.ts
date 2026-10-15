/**
 * How Clonyfy identifies itself. The capture browser keeps its own real user agent
 * (no override), and server-side fetches say plainly that they are Clonyfy — we never
 * pretend to be a human visitor's browser. Protected sites are cloned through the
 * Clonyfy Helper extension in the user's own browser instead (see helperCapture.ts).
 */
export const CLONYFY_USER_AGENT = 'Mozilla/5.0 (compatible; Clonyfy/1.0; +https://clonyfy.com)';
