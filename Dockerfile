FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
