import { useEffect, useState } from "react";
import { Download, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { markHelperInstalled } from "@/lib/api";
import { HELPER_INSTALL_URL, detectHelper, onHelperReady } from "@/lib/helper";

const DISMISS_KEY = "clonyfy_helper_onboarding_dismissed";
const FROM_STORE =
  /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com|microsoftedge\.microsoft\.com)\//.test(
    HELPER_INSTALL_URL,
  );

/**
 * Install-once onboarding: new users add the Clonyfy Helper in their first minute, so a
 * protected site later clones with one click instead of an install step. Whenever the
 * helper is detected, the account remembers it (the protected-site card never shows).
 */
export function HelperOnboarding() {
  const { user, refresh } = useAuth();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    let cancelled = false;
    void detectHelper().then((v) => !cancelled && setInstalled(!!v));
    const stop = onHelperReady(() => setInstalled(true));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (!installed || !user || user.helperInstalled) return;
    void markHelperInstalled()
      .then(() => refresh())
      .catch(() => {});
  }, [installed, user, refresh]);

  if (!user || installed !== false || user.helperInstalled || dismissed) return null;
  return (
    <aside className="surface flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center md:p-6">
      <ShieldCheck size={22} className="shrink-0 text-emerald-400" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          Clone protected sites too — install Clonyfy Helper once
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Some sites (like Zillow) block automated browsers on every page. The helper clones them
          from your own browser in one click. It copies only the public page — never cookies, logins
          or personal data.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={HELPER_INSTALL_URL}
          target={FROM_STORE ? "_blank" : undefined}
          rel="noreferrer"
          download={FROM_STORE ? undefined : "clonyfy-helper.zip"}
          className="dashboard-button bg-primary text-primary-foreground"
        >
          {FROM_STORE ? <ExternalLink size={16} /> : <Download size={16} />}
          Install helper
        </a>
        <button
          type="button"
          className="dashboard-button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
