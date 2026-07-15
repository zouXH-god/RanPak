FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/ranpak-cloud .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/ranpak-cloud .

RUN mkdir -p /app/data

ENV GIN_MODE=release
ENV PORT=8080
ENV DB_PATH=/app/data/ranpak.db

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["./ranpak-cloud"]
