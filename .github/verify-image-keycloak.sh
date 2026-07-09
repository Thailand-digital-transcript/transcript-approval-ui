#!/usr/bin/env bash
# Asserts the transcript-keycloak image imports the realm and serves it.
# Usage: ./.github/verify-image-keycloak.sh <image-tag>
set -euo pipefail
img="${1:?usage: verify-image-keycloak.sh <image-tag>}"
name="kc-verify-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

docker run --rm -d --name "$name" \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  "$img" start-dev --import-realm >/dev/null

ok=0
for _ in $(seq 1 30); do
  if docker exec "$name" sh -c \
    "exec 3<>/dev/tcp/localhost/8080 && printf 'GET /realms/transcript HTTP/1.1\r\nHost: localhost:8080\r\nConnection: close\r\n\r\n' >&3 && cat <&3 | head -n1 | grep -q 200" \
    2>/dev/null
  then
    ok=1
    break
  fi
  sleep 2
done
[ "$ok" = "1" ] || { echo "FAIL: /realms/transcript never returned 200"; docker logs "$name"; exit 1; }

# The load-bearing check: the transform actually ran. A ',' -> the jq filter
# never applied. The plain /realms/transcript endpoint above is the OIDC
# discovery-adjacent representation (realm name, public key, token-service
# URL) — it never echoes client attributes back, so it can't prove or
# disprove the transform either way (confirmed empirically: its body has no
# "clients" key at all). Mint an admin token instead and read the client
# attribute directly via the admin REST API.
#
# Both the token mint and the admin-API read are wrapped in the same retry
# loop as the readiness gate above: /realms/transcript returning 200 only
# proves the public realm endpoint is up, not that the admin REST API has
# finished loading clients into whatever internal state it queries. On a
# constrained/slower runner those two can become ready at meaningfully
# different times, so a single-shot check here can observe a real (non-error)
# but not-yet-fully-loaded response. Retrying turns that into a real
# wait-for-readiness instead of a race, and still fails (just slightly later)
# if the transform is genuinely missing from the image.
clients_ok=0
token_ok=0
clients_resp=""
for _ in $(seq 1 30); do
  token_resp=$(docker exec "$name" sh -c \
    'BODY="grant_type=password&client_id=admin-cli&username=admin&password=admin"; LEN=${#BODY}; \
     exec 3<>/dev/tcp/localhost/8080 && \
     printf "POST /realms/master/protocol/openid-connect/token HTTP/1.1\r\nHost: localhost:8080\r\nContent-Type: application/x-www-form-urlencoded\r\nConnection: close\r\nContent-Length: %s\r\n\r\n%s" "$LEN" "$BODY" >&3 && \
     cat <&3' 2>/dev/null)
  token=$(printf '%s' "$token_resp" | tail -n1 | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  if [ -n "$token" ]; then
    # Latch that the mint succeeded at least once, so the failure branch below
    # can tell "never authenticated" apart from "authenticated, but the realm
    # lacks the transform" — two different bugs that used to share a headline.
    token_ok=1
    # Captured to a variable rather than piped straight into `grep -q`: with
    # `pipefail` set, grep -q closes its stdin as soon as it matches, which
    # can SIGPIPE the still-writing docker/exec process upstream and make the
    # pipeline report failure even though grep found the match.
    clients_resp=$(docker exec "$name" sh -c \
      "exec 3<>/dev/tcp/localhost/8080 && printf 'GET /admin/realms/transcript/clients HTTP/1.1\r\nHost: localhost:8080\r\nAuthorization: Bearer $token\r\nConnection: close\r\n\r\n' >&3 && cat <&3" \
      2>/dev/null)
    if printf '%s' "$clients_resp" | grep -q '##'; then
      clients_ok=1
      break
    fi
  fi
  sleep 2
done

if [ "$clients_ok" != "1" ]; then
  if [ "$token_ok" != "1" ]; then
    echo "FAIL: never obtained an admin token from /realms/master (30 attempts)"
    echo "      — the transform was never checked; this is an auth/startup failure,"
    echo "        not evidence that the realm is missing the ## transform."
  else
    echo "FAIL: post.logout.redirect.uris does not contain ## — transform did not apply"
  fi
  echo "---- last admin API response received (for debugging) ----"
  # Redact client secrets: this realm's are published dev values, but dumping
  # whole admin payloads containing credential-shaped fields into CI logs is a
  # habit worth not forming.
  printf '%s\n' "$clients_resp" | sed 's/"secret":"[^"]*"/"secret":"<redacted>"/g'
  echo "---- end response ----"
  echo "---- container logs ----"
  docker logs "$name"
  exit 1
fi

echo "OK: $img imports the transcript realm with the ## transform applied"
