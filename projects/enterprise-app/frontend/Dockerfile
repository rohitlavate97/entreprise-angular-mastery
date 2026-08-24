# ==============================================================================
# Multi-Stage Build: Angular 19+ SPA with Nginx
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Build the Angular Standalone Application
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors for layer caching
COPY package*.json ./
RUN npm ci

# Copy full source and execute production build
COPY . .
RUN npm run build -- --configuration production

# -------------------------------------------------------------
# Stage 2: Production Nginx Serving & Reverse Proxy Layer
# -------------------------------------------------------------
FROM nginx:alpine

# Remove default Nginx welcome assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled standalone distribution assets from builder stage
COPY --from=builder /app/dist/enterprise-frontend/browser /usr/share/nginx/html

# Copy production-hardened Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
