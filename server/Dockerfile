FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js /app/server.js
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8090
ENV DB_PATH=/data/vaultship.db

EXPOSE 8090
VOLUME ["/data"]

ENTRYPOINT ["/app/entrypoint.sh"]
