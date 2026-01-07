.PHONY: all test test-unit test-integration lint build docker-build clean proto

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Services
SERVICES=payout-engine event-indexer webhook-handler

# Default target
all: proto build

# Generate protobuf code
proto:
	@echo "Generating protobuf code..."
	@chmod +x proto/generate.sh
	@./proto/generate.sh

# Build all services
build:
	@for service in $(SERVICES); do \
		echo "Building $$service..."; \
		cd $$service && $(GOBUILD) -o bin/$$service ./cmd/main.go && cd ..; \
	done

# Run all unit tests
test-unit:
	@echo "Running unit tests..."
	@for service in $(SERVICES); do \
		echo "Testing $$service..."; \
		cd $$service && $(GOTEST) -v -race -coverprofile=coverage.out ./... && cd ..; \
	done

# Run integration tests (requires docker)
test-integration:
	@echo "Running integration tests..."
	docker-compose -f docker-compose.test.yml up -d
	@for service in $(SERVICES); do \
		cd $$service && $(GOTEST) -v -tags=integration ./... && cd ..; \
	done
	docker-compose -f docker-compose.test.yml down

# Run all tests
test: test-unit

# Lint all services
lint:
	@echo "Linting..."
	@for service in $(SERVICES); do \
		echo "Linting $$service..."; \
		cd $$service && golangci-lint run ./... && cd ..; \
	done

# Build Docker images
docker-build:
	@for service in $(SERVICES); do \
		echo "Building Docker image for $$service..."; \
		docker build -t protocolbanks/$$service:latest ./$$service; \
	done

# Clean build artifacts
clean:
	@for service in $(SERVICES); do \
		rm -rf $$service/bin; \
		rm -f $$service/coverage.out; \
	done
	@rm -rf generated/

# Install dependencies
deps:
	@for service in $(SERVICES); do \
		cd $$service && $(GOMOD) download && cd ..; \
	done

# Tidy dependencies
tidy:
	@for service in $(SERVICES); do \
		cd $$service && $(GOMOD) tidy && cd ..; \
	done

# Run locally with docker-compose
run:
	docker-compose up -d

# Stop local services
stop:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Generate coverage report
coverage:
	@echo "Generating coverage report..."
	@for service in $(SERVICES); do \
		cd $$service && $(GOTEST) -coverprofile=coverage.out ./... && \
		$(GOCMD) tool cover -html=coverage.out -o coverage.html && cd ..; \
	done
