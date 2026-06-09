FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Playwright Chromium 브라우저 설치
RUN npx playwright install chromium --with-deps

COPY . .

# SQLite 데이터 디렉토리
RUN mkdir -p data logs

EXPOSE 3000

CMD ["node", "scheduler/cron.js"]
