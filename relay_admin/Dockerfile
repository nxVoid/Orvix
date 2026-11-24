# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-trixie AS builder

ARG TARGETARCH

WORKDIR /usr/src/app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates nodejs npm pkg-config \
	&& npm install -g pnpm@11.27.0 \
	&& rm -rf /var/lib/apt/lists/*

RUN npm install --no-audit --no-fund @tailwindcss/cli@4.2.1 tailwindcss@4.2.1
RUN TAILWIND_OXIDE_VERSION="4.2.1" \
	&& case "${TARGETARCH}" in \
		amd64) OXIDE_PKG="@tailwindcss/oxide-linux-x64-gnu" ;; \
		arm64) OXIDE_PKG="@tailwindcss/oxide-linux-arm64-gnu" ;; \
		*) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
	esac \
	&& npm install --no-audit --no-fund "${OXIDE_PKG}@${TAILWIND_OXIDE_VERSION}" \
	&& ls -la node_modules/.bin/tailwindcss

COPY Cargo.lock Cargo.lock
COPY relay_admin relay_admin
COPY relay_common relay_common
COPY packages/fonts/manifest.json packages/fonts/manifest.json
COPY packages/fonts/NOTICE.md packages/fonts/NOTICE.md
COPY packages/fonts/LICENSE-IBM-PLEX.txt packages/fonts/LICENSE-IBM-PLEX.txt
COPY packages/fonts/files/RelaySans packages/fonts/files/RelaySans
COPY packages/fonts/files/RelayMono packages/fonts/files/RelayMono
RUN printf '%s\n' \
	'[workspace]' \
	'members = ["relay_admin", "relay_common"]' \
	'resolver = "2"' \
	'' \
	'[workspace.package]' \
	'edition = "2024"' \
	'license = "AGPL-3.0-or-later"' \
	'' \
	'[profile.release]' \
	'lto = "fat"' \
	'codegen-units = 1' \
	'strip = "symbols"' \
	> Cargo.toml

RUN cargo build --release -p relay_admin \
	&& cp target/release/relay_admin /usr/local/bin/relay-admin

RUN test -s target/release/build/relay_admin-*/out/static/app.css \
	&& echo "Tailwind CSS compiled successfully"

RUN test "$(ls target/release/build/relay_admin-*/out/static/fonts/*.woff2 | wc -l)" -eq 16 \
	&& ls target/release/build/relay_admin-*/out/static/fonts/fonts.*.css \
	&& echo "Latin-core fonts bundled successfully"

FROM debian:trixie-slim AS runtime

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="relay-admin"
LABEL org.opencontainers.image.description="Orvix admin console"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Orvix"
LABEL org.opencontainers.image.url="https://fluxer.com"
LABEL org.opencontainers.image.documentation="https://docs.fluxer.com"
LABEL org.opencontainers.image.source="https://github.com/fluxerapp/fluxer"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.orvix.build-version="${BUILD_VERSION}"

WORKDIR /usr/local/bin

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

COPY --from=builder /usr/local/bin/relay-admin /usr/local/bin/relay-admin

ENV BUILD_VERSION="${BUILD_VERSION}"
ENV ORVIX_ADMIN_HOST="0.0.0.0"
ENV ORVIX_ADMIN_PORT="8080"

USER 65532:65532

EXPOSE 8080

CMD ["/usr/local/bin/relay-admin"]
