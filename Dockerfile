# One image for the whole web side of Rento: the API, with the admin panel built into it and served from the same address.
#   docker build -t rento .
#   docker run -p 3000:3000 -e DATABASE_URL=… -e JWT_SECRET=… -e HOST=0.0.0.0 rento
# On start it applies the database migrations (idempotent) and then runs the API. See docs/deploy-free-demo.md.

# ---- build: install everything, build the API and the admin panel
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @rento/api... --filter @rento/admin...
COPY packages packages
COPY apps/api apps/api
COPY apps/admin apps/admin
# Same-origin panel: it calls the API at its own address (an empty base URL).
ENV VITE_API_BASE_URL=""
RUN pnpm --filter @rento/api build && pnpm --filter @rento/admin build

# ---- run: production dependencies only, plus what was built
FROM node:22-slim AS run
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    TRUST_PROXY=true \
    ADMIN_STATIC_DIR=/app/admin
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --prod --filter @rento/api...
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/db apps/api/db
COPY --from=build /repo/apps/admin/dist /app/admin
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node apps/api/dist/db/migrate-cli.js && exec node apps/api/dist/main.js"]
