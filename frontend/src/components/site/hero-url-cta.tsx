import { useSiteLanguage } from "@/hooks/use-site-language";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Globe, Zap } from "lucide-react";

export function HeroUrlCta() {
  const { t: tr, language } = useSiteLanguage();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    try {
      const value = input.value.trim();
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname.includes(".") ||
        url.username ||
        url.password
      ) {
        throw new Error("Invalid website URL");
      }
      input.value = url.href;
      try {
        sessionStorage.setItem("clonyfy_pending_clone_url", url.href);
      } catch {
        /* ignore */
      }
      void navigate({
        to: language === "fr" ? "/fr/register" : "/register",
        search: { url: url.href } as never,
      });
    } catch {
      setError(tr("Enter a website URL, like example.com."));
      input.focus();
    }
  }

  return (
    <form className="hero-url-cta" onSubmit={handleSubmit} noValidate>
      <label htmlFor="hero-website-url" className="sr-only">
        {tr("Website URL to clone")}
      </label>
      <div className="hero-url-field" data-invalid={Boolean(error)}>
        <Globe className="hero-url-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id="hero-website-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={tr("Paste a website URL")}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "hero-url-error" : undefined}
          onChange={() => setError("")}
        />
        <button type="submit" className="hero-url-submit">
          {tr("Try it")} <Zap aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id="hero-url-error" className="hero-url-error" role="alert">
          {tr(error)}
        </p>
      )}
    </form>
  );
}
