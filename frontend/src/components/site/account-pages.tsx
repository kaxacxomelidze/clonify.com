import { Link } from "@tanstack/react-router";
import { useSiteLanguage } from "@/hooks/use-site-language";
import { AuthShell } from "./auth-shell";

export function LoginPage() {
  const { t: tr, language } = useSiteLanguage();
  return (
    <AuthShell
      title={tr("Welcome back.")}
      subtitle={tr("Log in to keep cloning, redesigning and shipping.")}
      submitLabel={tr("Log in")}
      mode="login"
      footer={
        <>
          {tr("New to Clonyfy?")}{" "}
          <Link
            to={language === "fr" ? "/fr/register" : "/register"}
            className="text-foreground underline underline-offset-4"
          >
            {tr("Create an account")}
          </Link>
        </>
      }
    />
  );
}

export function RegisterPage() {
  const { t: tr, language } = useSiteLanguage();
  return (
    <AuthShell
      title={tr("Start from reality.")}
      subtitle={tr("Create your account and clone your first site in under two minutes.")}
      submitLabel={tr("Get instant access")}
      mode="register"
      footer={
        <>
          {tr("Already have an account?")}{" "}
          <Link
            to={language === "fr" ? "/fr/login" : "/login"}
            className="text-foreground underline underline-offset-4"
          >
            {tr("Log in")}
          </Link>
        </>
      }
    />
  );
}
