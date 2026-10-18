FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
ENV NODE_ENV=production
USER node
CMD ["node", "index.mjs"]
