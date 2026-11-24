# SPDX-License-Identifier: AGPL-3.0-or-later
ARG BUILD_VERSION

FROM node:26-trixie-slim AS base

WORKDIR /usr/src/app

RUN npm install -g pnpm@11.27.0

FROM base AS deploy

RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		gcc \
		libssl-dev \
		pkg-config \
		openssl \
		python3 && \
	rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter relay_api run build
RUN pnpm deploy --legacy --filter=relay_api --prod --config.allow-unused-patches=true /out && \
	rm -rf /out/pkgs /out/dist

FROM node:26-trixie-slim

ARG BUILD_VERSION
ARG SOURCE_SHA
ARG SOURCE_DATE

LABEL org.opencontainers.image.title="relay-api"
LABEL org.opencontainers.image.description="Orvix HTTP API and background workers"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Orvix"
LABEL org.opencontainers.image.url="https://fluxer.com"
LABEL org.opencontainers.image.documentation="https://docs.fluxer.com"
LABEL org.opencontainers.image.source="https://github.com/fluxerapp/fluxer"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.orvix.build-version="${BUILD_VERSION}"

WORKDIR /usr/src/app/relay_api

RUN apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates && \
	rm -rf /var/lib/apt/lists/*

COPY --from=deploy --chown=65532:65532 /out ./
COPY --from=deploy --chown=65532:65532 /usr/src/app/relay_api/dist ./dist
COPY --from=deploy --chown=65532:65532 /usr/src/app/relay_api/bin ./bin
COPY --from=deploy --chown=65532:65532 /usr/src/app/tsconfigs /usr/src/app/tsconfigs

RUN mkdir -p /run/orvix && \
	chmod 700 /run/orvix && \
	chown 65532:65532 /usr/src/app /usr/src/app/relay_api /run/orvix

ENV HOME=/usr/src/app
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV BUILD_VERSION=${BUILD_VERSION}

USER 65532:65532

EXPOSE 8080

CMD ["node", "dist/AppEntrypoint.js"]
