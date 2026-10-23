# syntax=docker/dockerfile:1
# Build stage: install deps and build SPA
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY .npmrc ./
RUN --mount=type=secret,id=fontawesome_token,env=FONTAWESOME_PACKAGE_TOKEN,required=true npm ci --no-audit --no-fund

COPY . .
ARG VITE_SHARED_ACCOUNTS=false
ARG VITE_BASE_PATH=/
ENV VITE_SHARED_ACCOUNTS=${VITE_SHARED_ACCOUNTS}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

# Runtime: serve SPA + reverse-proxy API via nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
ARG NGINX_CONFIG=nginx.conf
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
