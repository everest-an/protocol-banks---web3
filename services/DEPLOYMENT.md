# Protocol Banks Go Services Deployment Guide

## Overview

This guide covers deploying the three Go microservices:

1. **payout-engine** - Handles batch payment processing (gRPC, port 50051)
2. **event-indexer** - Indexes blockchain events (gRPC, port 50052)
3. **webhook-handler** - Handles external webhooks from Rain, Transak, etc. (HTTP, port 8080)

## Prerequisites

- Docker and Docker Compose installed
- Access to a PostgreSQL database (Supabase)
- Redis instance (included in docker-compose or external)
- RPC endpoints for Ethereum, Base, Arbitrum

## Quick Start

### 1. Configure Environment

\`\`\`bash
cd services
cp .env.example .env
# Edit .env with your actual values
\`\`\`

### 2. Build and Run

\`\`\`bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
\`\`\`

## Production Deployment

### Option 1: Docker Compose on VPS

\`\`\`bash
# SSH to your server
ssh user@your-server

# Clone the repository
git clone https://github.com/your-org/protocol-banks.git
cd protocol-banks/services

# Configure environment
cp .env.example .env
nano .env  # Edit with production values

# Start with production settings
docker-compose -f docker-compose.yml up -d

# Setup nginx reverse proxy for webhook-handler
# See nginx.conf example below
\`\`\`

### Option 2: Individual Docker Containers

\`\`\`bash
# Build each service
docker build -t protocol-banks/payout-engine ./payout-engine
docker build -t protocol-banks/event-indexer ./event-indexer
docker build -t protocol-banks/webhook-handler ./webhook-handler

# Run with specific configurations
docker run -d \
  --name payout-engine \
  -p 50051:50051 \
  --env-file .env \
  protocol-banks/payout-engine
\`\`\`

## Service Configuration

### Payout Engine

Environment variables:
- `GRPC_PORT` - gRPC server port (default: 50051)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `API_SECRET` - Secret for gRPC authentication
- `PAYOUT_PRIVATE_KEY` - Private key for signing transactions

### Event Indexer

Environment variables:
- `GRPC_PORT` - gRPC server port (default: 50052)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ETH_RPC_URL`, `BASE_RPC_URL`, `ARBITRUM_RPC_URL` - RPC endpoints
- `WATCHED_ADDRESSES` - Comma-separated contract addresses to watch

### Webhook Handler

Environment variables:
- `HTTP_PORT` - HTTP server port (default: 8080)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `RAIN_API_KEY`, `RAIN_WEBHOOK_SECRET` - Rain Card credentials
- `TRANSAK_API_KEY`, `TRANSAK_WEBHOOK_SECRET` - Transak credentials

## Nginx Configuration (for webhook-handler)

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name webhooks.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
\`\`\`

## Health Checks

All services expose health check endpoints:

- Payout Engine: `grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check`
- Event Indexer: `grpcurl -plaintext localhost:50052 grpc.health.v1.Health/Check`
- Webhook Handler: `curl http://localhost:8080/health`

## Monitoring

### Logs

\`\`\`bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f payout-engine
\`\`\`

### Metrics

Each service exposes Prometheus metrics at `/metrics` endpoint (webhook-handler) or via gRPC reflection.

## Connecting to Next.js App

Update your Next.js environment variables:

\`\`\`env
PAYOUT_ENGINE_URL=your-server:50051
EVENT_INDEXER_URL=your-server:50052
WEBHOOK_HANDLER_URL=https://webhooks.yourdomain.com
\`\`\`

## Troubleshooting

### Service won't start

1. Check logs: `docker-compose logs service-name`
2. Verify environment variables
3. Ensure Redis is running and accessible
4. Verify database connection

### Webhook not receiving events

1. Verify webhook URL is publicly accessible
2. Check SSL certificate is valid
3. Verify webhook secret matches provider configuration
4. Check webhook-handler logs for errors

### Batch payments failing

1. Check payout-engine logs
2. Verify private key has sufficient balance
3. Verify RPC endpoints are responsive
4. Check nonce management in Redis
