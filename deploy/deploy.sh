#!/usr/bin/env bash
#
# Provision and deploy TheraSync to Cloud Run.
#
# Safe to re-run: every step checks for a resource before creating it, so this
# script doubles as the record of how the environment was built.
#
# Prerequisites:
#   - gcloud, authenticated (gcloud auth login)
#   - a Postgres database with init-db/01-init.sql already applied
#
# Usage, first run:
#   DATABASE_URL='postgresql://user:pass@host:6543/postgres' \
#   BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX deploy/deploy.sh
#
# Usage, subsequent deploys (the stored secret is reused):
#   deploy/deploy.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-therasync-demo}"
REGION="${REGION:-us-east4}"
SERVICE="${SERVICE:-therasync}"
SECRET="${SECRET:-therasync-database-url}"
RUNTIME_SA_ID="${RUNTIME_SA_ID:-therasync-run}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"

RUNTIME_SA="${RUNTIME_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }

# 1. Project.
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  log "Project $PROJECT_ID already exists"
else
  log "Creating project $PROJECT_ID"
  gcloud projects create "$PROJECT_ID" --name=TheraSync
fi

# 2. Billing, without which Cloud Run cannot even be enabled. Note that each
#    billing account caps how many projects may be linked to it; a quota
#    violation here means passing a different BILLING_ACCOUNT, not retrying.
if [ "$(gcloud billing projects describe "$PROJECT_ID" \
        --format='value(billingEnabled)' 2>/dev/null)" != "True" ]; then
  if [ -z "$BILLING_ACCOUNT" ]; then
    echo "Billing is not enabled on $PROJECT_ID." >&2
    echo "Re-run with BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX (see: gcloud billing accounts list)." >&2
    exit 1
  fi
  log "Linking billing account $BILLING_ACCOUNT"
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
fi

# 3. APIs.
log "Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# 4. The database connection string lives in Secret Manager, never in the
#    service's plaintext environment.
if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  if [ -n "${DATABASE_URL:-}" ]; then
    log "Adding a new version of secret $SECRET"
    printf '%s' "$DATABASE_URL" \
      | gcloud secrets versions add "$SECRET" --project="$PROJECT_ID" --data-file=-
  else
    log "Secret $SECRET exists; keeping its current version"
  fi
else
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL must be set on the first run, to seed the $SECRET secret." >&2
    exit 1
  fi
  log "Creating secret $SECRET"
  printf '%s' "$DATABASE_URL" | gcloud secrets create "$SECRET" \
    --project="$PROJECT_ID" --replication-policy=automatic --data-file=-
fi

# 5. A dedicated runtime identity that holds nothing beyond read access to
#    that one secret.
if ! gcloud iam service-accounts describe "$RUNTIME_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  log "Creating runtime service account $RUNTIME_SA_ID"
  gcloud iam service-accounts create "$RUNTIME_SA_ID" \
    --project="$PROJECT_ID" --display-name="TheraSync Cloud Run runtime"
  # Service account creation is eventually consistent, and a policy binding
  # that names an unpropagated account fails outright.
  for _ in $(seq 1 15); do
    gcloud iam service-accounts describe "$RUNTIME_SA" --project="$PROJECT_ID" >/dev/null 2>&1 && break
  done
fi

log "Granting $RUNTIME_SA_ID read access to $SECRET"
gcloud secrets add-iam-policy-binding "$SECRET" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null

# 6. Deploy.
#
# --max-instances=1 is load-bearing rather than a cost control. /api/book/lock
# holds slot reservations in process memory, so a second instance would not see
# a lock taken by the first and the follow-up /api/book/commit would be
# rejected with LOCK_REQUIRED. Raising this limit requires moving the locks
# into Postgres first.
log "Deploying $SERVICE to $REGION"
gcloud run deploy "$SERVICE" \
  --source="$REPO_ROOT" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="$RUNTIME_SA" \
  --set-secrets="DATABASE_URL=${SECRET}:latest" \
  --max-instances=1 \
  --min-instances=0 \
  --cpu=1 \
  --memory=512Mi \
  --port=8080 \
  --quiet

URL="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
log "Deployed: $URL"
curl -fsS "$URL/api/health" && printf '\n'
