FROM alpine:3.20 AS transform
RUN apk add --no-cache jq
COPY realm-export.json realm-transform.jq ./
RUN jq -f realm-transform.jq realm-export.json > realm-export.transformed.json

FROM quay.io/keycloak/keycloak:26.6.3
COPY --from=transform /realm-export.transformed.json /opt/keycloak/data/import/realm-export.json
