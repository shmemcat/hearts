# Build stage: install deps and build SPA
FROM node:20-alpine AS builder

WORKDIR /app

ARG FONTAWESOME_PACKAGE_TOKEN
ENV FONTAWESOME_PACKAGE_TOKEN=${FONTAWESOME_PACKAGE_TOKEN}

COPY package.json package-lock.json* ./
COPY .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime: serve SPA + reverse-proxy API via nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
