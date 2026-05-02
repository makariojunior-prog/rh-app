FROM node:20-alpine

WORKDIR /app
COPY backup.js .

# Instala o cron do Alpine
RUN apk add --no-cache dcron

# Cria o job: todo dia às 02:00 (horário do container = UTC-3 se TZ estiver definido)
RUN echo "0 2 * * * cd /app && node backup.js >> /backups/backup_log.txt 2>&1" \
    > /etc/crontabs/root

CMD ["crond", "-f", "-l", "2"]
