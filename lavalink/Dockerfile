FROM eclipse-temurin:17-jre-alpine

# إنشاء مجلد التطبيق
WORKDIR /app

# تثبيت curl للـ health check
RUN apk add --no-cache curl

# جلب أحدث إصدار من Lavalink
ARG LAVALINK_VERSION=4.0.8
RUN curl -fsSL \
    "https://github.com/lavalink-devs/Lavalink/releases/download/${LAVALINK_VERSION}/Lavalink.jar" \
    -o Lavalink.jar

# إنشاء مجلد الـ plugins
RUN mkdir -p plugins

# نسخ ملف الإعداد
COPY application.yml ./application.yml

# إنشاء مجلد اللوجز
RUN mkdir -p logs

# Port — Railway يحدد الـ PORT تلقائياً، 2333 هو الافتراضي
EXPOSE ${PORT:-2333}

# Health Check — يستخدم PORT لو موجود وإلا 2333
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-2333}/version || exit 1

# تشغيل Lavalink
ENTRYPOINT ["java", \
  "-Xmx512m", \
  "-Xms256m", \
  "-XX:+UseG1GC", \
  "-XX:G1ReservePercent=20", \
  "-Djdk.tls.client.protocols=TLSv1.2", \
  "-jar", "Lavalink.jar"]
