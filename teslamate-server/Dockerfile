FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package.json ./
COPY --from=build /app/dist ./dist
RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
