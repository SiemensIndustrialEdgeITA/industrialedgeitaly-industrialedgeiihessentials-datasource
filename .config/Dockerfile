ARG grafana_version=10.4.0
ARG grafana_image=grafana-oss

FROM grafana/${grafana_image}:${grafana_version}


USER root

# install required packages
RUN apk add --no-cache ca-certificates bash curl tzdata && \
    apk add --no-cache openssl --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main

# Make it as simple as possible to access the grafana instance for development purposes
# Do NOT enable these settings in a public facing / production grafana instance
ENV GF_AUTH_ANONYMOUS_ORG_ROLE "Admin"
ENV GF_AUTH_ANONYMOUS_ENABLED "true"
ENV GF_AUTH_BASIC_ENABLED "false"
# Set development mode so plugins can be loaded without the need to sign
ENV GF_DEFAULT_APP_MODE "development"
# Set 
ENV GF_SECURITY_COOKIE_SAMESITE "disabled"
ENV GF_SECURITY_COOKIE_SECURE "false"
ENV GF_SECURITY_ALLOW_EMBEDDING "true"
ENV GF_SECURITY_X_XSS_PROTECTION "false"
ENV GF_SERVER_PROTOCOL "https"
ENV GF_SERVER_CERT_FILE "/etc/grafana/sscerts/grafana.crt"
ENV GF_SERVER_CERT_KEY "/etc/grafana/sscerts/grafana.key"
ENV GF_PANELS_DISABLE_SANITIZE_HTML "true"
ENV IGNORE_HTTPS_ERRORS="true"

# generate HTTPS certs
RUN mkdir -p /etc/grafana/sscerts &&\
    openssl req -newkey rsa:2048 -x509 -nodes -days 3650 \
    -subj "/C=IT/ST=IT/L=Milan/O=Siemens/CN=edge-grafana" \
    -addext "subjectAltName=DNS:edge-grafana" \
    -keyout /etc/grafana/sscerts/grafana.key -out /etc/grafana/sscerts/grafana.crt &&\
    chmod -R 775 /etc/grafana/sscerts &&\
    chown -R grafana:root /etc/grafana/sscerts

# Inject livereload script into grafana index.html
#USER root
RUN sed -i 's/<\/body><\/html>/<script src=\"http:\/\/localhost:35729\/livereload.js\"><\/script><\/body><\/html>/g' /usr/share/grafana/public/views/index.html