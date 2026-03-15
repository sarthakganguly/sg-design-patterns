FROM node:20-bookworm-slim
RUN npm install -g pnpm@9.0.0

WORKDIR /workspace

# Copy essential config
COPY package.json pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Copy entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Do NOT run pnpm install here; do it in entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]