# ------------------------------------------------------
# Stage 1: Build Angular App
# ------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else echo "No lockfile found" && exit 1; \
  fi

COPY . .

RUN npx ng build --configuration=production


# ------------------------------------------------------
# Stage 2: NGINX Web Server
# ------------------------------------------------------
FROM nginx:stable-alpine AS runner

WORKDIR /usr/share/nginx/html

# Copy Angular build files
COPY --from=builder /app/dist/vms-web-angular-revamp/browser/ ./ 

# Copy NGINX config supporting SPA + HTTPS
COPY nginx.conf /etc/nginx/conf.d/default.conf

# IMPORTANT: Expose both HTTP and HTTPS
EXPOSE 800
EXPOSE 8443

CMD ["nginx", "-g", "daemon off;"]
