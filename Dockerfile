# Stage 1: Build the Vite React frontend
FROM node:18 AS frontend-build
WORKDIR /app/vitereact
COPY vitereact/package.json  ./
RUN npm install --legacy-peer-deps
RUN npm install --save-dev eslint-plugin-import eslint-plugin-react @typescript-eslint/parser @typescript-eslint/eslint-plugin
RUN npm install --save-dev eslint-import-resolver-typescript
COPY vitereact ./
RUN npm run build

# Stage 2: Set up the Node.js backend
FROM node:18
WORKDIR /app/backend
COPY backend/package.json  ./
RUN npm install --production
COPY backend ./
COPY --from=frontend-build /app/vitereact/public /app/backend/public
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["sh", "-c", "node initdb.js && NODE_ENV=production node server.js"]