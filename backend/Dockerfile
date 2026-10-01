FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates curl dumb-init git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN npx playwright-core install --with-deps chromium
# The cloner resolves its own (newer) playwright-core; install the matching browser too,
# otherwise it silently falls back to the serverless @sparticuz Chromium (--single-process),
# which crashes under concurrent page captures and drops pages.
RUN cd packages/cloner && npx --no-install playwright-core install --with-deps chromium

RUN mkdir -p /data/output /ms-playwright && \
    chown -R node:node /app /data /ms-playwright

USER node

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
