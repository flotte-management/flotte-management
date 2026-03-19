# ─────────────────────────────────────────
# Étape 1 : Build Go
# ─────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o event-service ./cmd/main.go

# ─────────────────────────────────────────
# Étape 2 : Image ultra-légère
# ─────────────────────────────────────────
FROM scratch                  

COPY --from=builder /app/event-service .

EXPOSE 8080

CMD ["./event-service"]
