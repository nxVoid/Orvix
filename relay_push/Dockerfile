# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-trixie AS builder

WORKDIR /usr/src/app

COPY . .

RUN cargo build --release -p relay-push

FROM debian:trixie-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="relay-push"
LABEL org.opencontainers.image.description="Orvix push notification delivery service and push relay"
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

COPY --from=builder /usr/src/app/target/release/relay-push /usr/local/bin/relay-push

ENV BUILD_VERSION="${BUILD_VERSION}"

USER 65532:65532

EXPOSE 8126 8127

CMD ["/usr/local/bin/relay-push"]
