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

# IMPORTANT: Copy Angular browser build output
COPY --from=builder /app/dist/vms-web-angular-revamp/browser/ ./ 

# SPA routing config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
