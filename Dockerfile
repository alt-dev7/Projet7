FROM node:22-alpine AS front-build

WORKDIR /src

COPY front/package.json front/package-lock.json ./
RUN npm ci

COPY front ./
RUN npx ng build --optimization

FROM gradle:8.7-jdk17 AS back-build

WORKDIR /src

COPY back ./
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine AS back

RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=back-build /src/build/libs/microcrm-0.0.1-SNAPSHOT.jar back/microcrm.jar

USER app

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["java", "-jar", "/app/back/microcrm.jar"]

FROM caddy:2-alpine AS front

RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=front-build /src/dist/microcrm/browser front
COPY misc/docker/Caddyfile Caddyfile

USER app

ENV XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["caddy", "run", "--config", "/app/Caddyfile", "--adapter", "caddyfile"]
