import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { getSiteLanguage } from "@/lib/site-language";
import { useSiteLanguage } from "@/hooks/use-site-language";
import { SiteNotFound } from "@/components/site/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { SmoothScroll } from "../components/smooth-scroll";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const { t: tr, localPath } = useSiteLanguage();
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {tr("This page didn't load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Something went wrong on our end. You can try refreshing or head back home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {tr("Try again")}
          </button>
          <a
            href={localPath("/")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {tr("Go home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#050505" },
      { title: "Clonyfy — Clone any website with AI in seconds" },
      {
        name: "description",
        content:
          "Paste any URL and get a pixel-perfect, fully editable clone instantly. No design or coding skills required.",
      },
      { name: "author", content: "Clonyfy" },
      { property: "og:title", content: "Clonyfy — Clone any website with AI in seconds" },
      {
        property: "og:description",
        content:
          "Paste any URL and get a pixel-perfect, fully editable clone instantly. No design or coding skills required.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Clonyfy" },
      { property: "og:image", content: "https://www.clonyfy.com/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Clonyfy — Clone any website with AI in seconds." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://www.clonyfy.com/og-image.png" },
      { name: "twitter:image:alt", content: "Clonyfy — Clone any website with AI in seconds." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48" },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=2", sizes: "64x64" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: SiteNotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const language = useRouterState({ select: (state) => getSiteLanguage(state.location.pathname) });
  return (
    <html lang={language} className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <SmoothScroll>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </SmoothScroll>
          <Toaster position="top-center" richColors closeButton />
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  );
}
