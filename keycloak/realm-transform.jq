# Normalizes `post.logout.redirect.uris` from "," to "##". Keycloak stores
# multivalued client attributes as a `##`-separated string; the realm export
# UI tooling joins them with commas, which Keycloak then parses as one giant
# URI matching nothing — every RP-initiated logout fails with
# "Invalid redirect uri". Shared by two consumers so they can never drift:
# this image's own build (keycloak/Dockerfile, this repo) and
# e2e-harness/scripts/sync-realm.sh (build-from-source paths).
#
# organizationsEnabled does NOT need stripping here: that was a Keycloak
# 24.0.5-only workaround. Verified empirically against 26.6.3 — the realm
# imports and serves fine with organizationsEnabled present, untouched.
.clients |= map(
  if .attributes and .attributes["post.logout.redirect.uris"]
  then .attributes["post.logout.redirect.uris"] |= gsub(",";"##")
  else . end)
