# Self-hosting option (e.g. next to your n8n server). Vercel does not need this file.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# fonts for the share image + migrations runner
COPY --from=build /app/node_modules/@fontsource/yeseva-one/files ./node_modules/@fontsource/yeseva-one/files
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
COPY db ./db
COPY scripts/migrate.mjs ./scripts/migrate.mjs
USER app
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
