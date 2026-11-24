#!/bin/bash
echo "============================================================"
echo "  Starting Relay Music Bot (Docker Compose)"
echo "============================================================"
docker compose up -d --build
echo
echo "Containers launched. Streaming bot logs (Ctrl+C to exit log view):"
docker compose logs -f bot
