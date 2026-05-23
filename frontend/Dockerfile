# Build Stage
FROM node:18-alpine AS build-stage

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm ci

# Copy codebase and compile Vite build
COPY . .
RUN npm run build

# Production Stage
FROM nginx:stable-alpine AS production-stage

# Copy build folder to Nginx standard serving directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration if routing control is needed (SPA routing fallback)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
