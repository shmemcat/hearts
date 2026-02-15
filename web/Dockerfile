# Build stage: install deps and export static site
FROM node:20-alpine AS builder

WORKDIR /app

# Optional: pass at build time for Font Awesome Pro (e.g. docker compose build --build-arg FONTAWESOME_PACKAGE_TOKEN=xxx)
ARG FONTAWESOME_PACKAGE_TOKEN
ENV FONTAWESOME_PACKAGE_TOKEN=${FONTAWESOME_PACKAGE_TOKEN}

COPY package.json package-lock.json* ./
COPY .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime: serve static export with nginx
FROM nginx:alpine

COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
