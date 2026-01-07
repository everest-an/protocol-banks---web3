# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /event-indexer ./cmd/main.go

# Runtime stage
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /event-indexer .

RUN adduser -D -g '' appuser
USER appuser

EXPOSE 50052

ENTRYPOINT ["./event-indexer"]
