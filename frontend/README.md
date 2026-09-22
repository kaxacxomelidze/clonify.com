# Clonyfy Premium Launch

Clonyfy's marketing website, built with React, TypeScript, TanStack Start and Tailwind CSS. Animation uses GSAP, Motion and Lenis.

The site uses a fixed dark theme. Custom SVG product scenes pause outside the viewport and respect reduced-motion preferences. Mobile touch scrolling remains native.

## Development

```sh
npm install
npm run dev
```

The development server defaults to port 8080.

Copy `.env.example` to `.env` and set:

```
VITE_API_BASE_URL=http://localhost:5000
```

Point this at your Backend (local or Render). The Frontend calls `/api/*` on that origin with `X-Auth-Token` after login.

## Validation and production build

```sh
npx tsc --noEmit
npm run lint
npm run build
npm run preview
```

The production build uses Nitro's Node server preset. The server entry is `.output/server/index.mjs` and public assets are in `.output/public`. Deploy the complete `.output` directory; this is a server-rendered application.

For a Node hosting service, use `npm run build` as the build command and `npm start` as the start command. The existing command `node .output/server/index.mjs` also works. The server reads the host's `PORT` environment variable. `npm run preview` starts the same production server locally (port 3000 by default).

If the host reports a missing `.output/server/index.mjs`, rebuild and redeploy this version. Earlier builds targeted a Cloudflare worker in `dist`, which cannot be started with the Node command above.

## Routes and branding

- `/`: marketing homepage.
- `/login` and `/register`: account page layouts. Their forms are not connected to authentication in this repository.
- `src/routes/__root.tsx`: shared metadata, icons, styles and error boundary.
- `src/creative.css`: editorial layout, SVG presentation and responsive styling.
- `src/hooks/use-scene.ts`: lifecycle and visibility controls for decorative GSAP scenes.
- `public/favicon.svg`: source for the Clonyfy tab and touch icons.
- `public/og-image.svg`: source for the 1200 x 630 social preview PNG.

The social image metadata targets `https://www.clonyfy.com/og-image.png`. Publish the asset at that domain with the rest of the site.

See [the site review and premium design direction](docs/site-review.md) and [the original design brief](docs/design-brief.md).
