FROM node:20
# ffmpeg: last frame of a clip = start frame of the next clip (video continuity)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --include=dev --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
