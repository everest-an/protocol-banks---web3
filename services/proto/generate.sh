#!/bin/bash
# Generate gRPC code for Go and TypeScript

set -e

PROTO_DIR="$(dirname "$0")"
GO_OUT_DIR="$PROTO_DIR/../generated/go"
TS_OUT_DIR="$PROTO_DIR/../generated/ts"

# Create output directories
mkdir -p "$GO_OUT_DIR"
mkdir -p "$TS_OUT_DIR"

# Generate Go code
protoc \
  --proto_path="$PROTO_DIR" \
  --go_out="$GO_OUT_DIR" \
  --go_opt=paths=source_relative \
  --go-grpc_out="$GO_OUT_DIR" \
  --go-grpc_opt=paths=source_relative \
  "$PROTO_DIR"/*.proto

# Generate TypeScript code (using ts-proto)
protoc \
  --proto_path="$PROTO_DIR" \
  --plugin=protoc-gen-ts_proto="$(which protoc-gen-ts_proto)" \
  --ts_proto_out="$TS_OUT_DIR" \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=useExactTypes=false \
  "$PROTO_DIR"/*.proto

echo "Generated gRPC code successfully!"
