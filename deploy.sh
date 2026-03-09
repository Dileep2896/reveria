#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Reveria — Automated Cloud Deployment Script
# Deploys backend to Cloud Run and frontend to Firebase Hosting
#
# Prerequisites:
#   - gcloud CLI authenticated with project access
#   - firebase CLI authenticated
#   - Node.js 20+ and npm installed
#   - Python 3.12+ installed
#
# Usage:
#   ./deploy.sh              # Deploy both backend and frontend
#   ./deploy.sh backend      # Deploy backend only
#   ./deploy.sh frontend     # Deploy frontend only
#   ./deploy.sh setup        # First-time GCP project setup
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
GCP_PROJECT="storyforge-hackathon"
GCP_REGION="us-central1"
CLOUD_RUN_SERVICE="storyforge-backend"
FIREBASE_PROJECT="storyforge-hackathon-1beac"
GCLOUD_CONFIG="default"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log()   { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()    { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ warn ]${NC} $1"; }
err()   { echo -e "${RED}[error ]${NC} $1"; }
header(){ echo -e "\n${PURPLE}═══ $1 ═══${NC}\n"; }

# ─── Preflight Checks ────────────────────────────────────────────────────────
preflight() {
    header "Preflight Checks"

    # gcloud
    if ! command -v gcloud &> /dev/null; then
        err "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    ok "gcloud CLI found"

    # Activate correct gcloud config
    gcloud config configurations activate "$GCLOUD_CONFIG" --quiet 2>/dev/null || true
    ok "gcloud config: $GCLOUD_CONFIG"

    # Verify project
    ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$ACTIVE_PROJECT" != "$GCP_PROJECT" ]; then
        warn "Active project is '$ACTIVE_PROJECT', switching to '$GCP_PROJECT'"
        gcloud config set project "$GCP_PROJECT" --quiet
    fi
    ok "GCP project: $GCP_PROJECT"

    # Node.js
    if ! command -v node &> /dev/null; then
        err "Node.js not found. Install Node.js 20+"
        exit 1
    fi
    NODE_VERSION=$(node --version)
    ok "Node.js: $NODE_VERSION"

    # npm
    if ! command -v npm &> /dev/null; then
        err "npm not found"
        exit 1
    fi
    ok "npm: $(npm --version)"

    # Firebase CLI
    if ! command -v firebase &> /dev/null && ! npx firebase --version &> /dev/null 2>&1; then
        warn "firebase CLI not found globally. Will use npx."
    else
        ok "Firebase CLI found"
    fi
}

# ─── First-Time GCP Setup ────────────────────────────────────────────────────
setup() {
    header "First-Time GCP Project Setup"

    log "Enabling required APIs..."
    gcloud services enable \
        run.googleapis.com \
        cloudbuild.googleapis.com \
        aiplatform.googleapis.com \
        firestore.googleapis.com \
        storage.googleapis.com \
        firebase.googleapis.com \
        --project="$GCP_PROJECT" \
        --quiet

    ok "APIs enabled"

    log "Creating GCS bucket (if not exists)..."
    gsutil ls -b "gs://storyforge-hackathon-media" 2>/dev/null || \
        gsutil mb -l "$GCP_REGION" -p "$GCP_PROJECT" "gs://storyforge-hackathon-media"
    ok "GCS bucket: storyforge-hackathon-media"

    log "Setting CORS on GCS bucket..."
    cat > /tmp/cors.json << 'CORS'
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
CORS
    gsutil cors set /tmp/cors.json "gs://storyforge-hackathon-media"
    rm /tmp/cors.json
    ok "CORS configured"

    log "Creating CI/CD service account (if not exists)..."
    SA_EMAIL="ci-deploy@${GCP_PROJECT}.iam.gserviceaccount.com"
    if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$GCP_PROJECT" &>/dev/null; then
        gcloud iam service-accounts create ci-deploy \
            --display-name="CI/CD Deploy" \
            --project="$GCP_PROJECT"
        ok "Service account created: $SA_EMAIL"
    else
        ok "Service account exists: $SA_EMAIL"
    fi

    log "Granting IAM roles to CI service account..."
    for ROLE in roles/run.admin roles/cloudbuild.builds.editor roles/storage.admin roles/iam.serviceAccountUser; do
        gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="$ROLE" \
            --quiet 2>/dev/null
    done
    ok "IAM roles granted"

    echo ""
    ok "Setup complete! Next steps:"
    log "  1. Create a service account key for CI:"
    log "     gcloud iam service-accounts keys create key.json --iam-account=$SA_EMAIL"
    log "  2. Add the key as GCP_SA_KEY secret in GitHub Actions"
    log "  3. Configure Firebase project and add FIREBASE_SERVICE_ACCOUNT secret"
    log "  4. Set VITE_* env secrets in GitHub Actions"
}

# ─── Deploy Backend to Cloud Run ─────────────────────────────────────────────
deploy_backend() {
    header "Deploying Backend to Cloud Run"

    if [ ! -f "$BACKEND_DIR/Dockerfile" ]; then
        err "Backend Dockerfile not found at $BACKEND_DIR/Dockerfile"
        exit 1
    fi

    if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
        err "requirements.txt not found at $BACKEND_DIR/requirements.txt"
        exit 1
    fi

    log "Building and deploying to Cloud Run..."
    log "Service: $CLOUD_RUN_SERVICE"
    log "Region:  $GCP_REGION"
    log "Project: $GCP_PROJECT"

    gcloud run deploy "$CLOUD_RUN_SERVICE" \
        --source "$BACKEND_DIR" \
        --project "$GCP_PROJECT" \
        --region "$GCP_REGION" \
        --allow-unauthenticated \
        --cpu-boost \
        --memory 1Gi \
        --timeout 300 \
        --min-instances 0 \
        --max-instances 10 \
        --quiet

    # Get the service URL
    SERVICE_URL=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
        --project "$GCP_PROJECT" \
        --region "$GCP_REGION" \
        --format 'value(status.url)' 2>/dev/null)

    ok "Backend deployed: $SERVICE_URL"
    echo ""
    log "WebSocket URL: ${SERVICE_URL/https/wss}/ws"
}

# ─── Deploy Frontend to Firebase Hosting ──────────────────────────────────────
deploy_frontend() {
    header "Deploying Frontend to Firebase Hosting"

    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        err "package.json not found at $FRONTEND_DIR/package.json"
        exit 1
    fi

    # Check for required env vars
    local missing_vars=()
    [ -z "${VITE_FIREBASE_API_KEY:-}" ] && missing_vars+=("VITE_FIREBASE_API_KEY")
    [ -z "${VITE_FIREBASE_AUTH_DOMAIN:-}" ] && missing_vars+=("VITE_FIREBASE_AUTH_DOMAIN")
    [ -z "${VITE_FIREBASE_PROJECT_ID:-}" ] && missing_vars+=("VITE_FIREBASE_PROJECT_ID")
    [ -z "${VITE_WS_URL:-}" ] && missing_vars+=("VITE_WS_URL")

    if [ ${#missing_vars[@]} -gt 0 ]; then
        warn "Missing env vars: ${missing_vars[*]}"
        log "Checking for .env file..."
        if [ -f "$FRONTEND_DIR/.env" ]; then
            log "Loading from $FRONTEND_DIR/.env"
            set -a
            source "$FRONTEND_DIR/.env"
            set +a
            ok "Env vars loaded from .env"
        else
            err "No .env file found. Set these env vars or create frontend/.env"
            exit 1
        fi
    fi

    log "Installing dependencies..."
    (cd "$FRONTEND_DIR" && npm ci --silent)
    ok "Dependencies installed"

    log "Building production bundle..."
    (cd "$FRONTEND_DIR" && npm run build)
    ok "Build complete"

    log "Deploying to Firebase Hosting..."
    (cd "$FRONTEND_DIR" && npx firebase deploy --only hosting --project "$FIREBASE_PROJECT")

    ok "Frontend deployed to Firebase Hosting"
}

# ─── Run Tests ────────────────────────────────────────────────────────────────
run_tests() {
    header "Running Tests"

    log "Backend tests..."
    if [ -f "$BACKEND_DIR/requirements-test.txt" ]; then
        (cd "$BACKEND_DIR" && pip install -q -r requirements-test.txt && pytest -v)
        ok "Backend tests passed"
    else
        warn "No requirements-test.txt found, skipping backend tests"
    fi

    log "Frontend lint + build..."
    (cd "$FRONTEND_DIR" && npm ci --silent && npx eslint . && npm run build)
    ok "Frontend lint + build passed"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    local TARGET="${1:-all}"

    echo -e "${PURPLE}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║     Reveria — Cloud Deployment       ║"
    echo "  ║   Google Cloud Run + Firebase        ║"
    echo "  ╚══════════════════════════════════════╝"
    echo -e "${NC}"

    case "$TARGET" in
        setup)
            preflight
            setup
            ;;
        backend)
            preflight
            deploy_backend
            ;;
        frontend)
            preflight
            deploy_frontend
            ;;
        test)
            run_tests
            ;;
        all)
            preflight
            deploy_backend
            deploy_frontend
            ;;
        *)
            echo "Usage: $0 {all|backend|frontend|setup|test}"
            exit 1
            ;;
    esac

    echo ""
    ok "Deployment complete!"
}

main "$@"
