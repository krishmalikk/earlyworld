#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root, using a project owner / infrastructure deployer identity.
project="${1:?Usage: deploy-worker.sh PROJECT BUCKET FUNCTIONS_SERVICE_ACCOUNT}"
bucket="${2:?Pass the existing private Firebase Storage bucket name}"
functions_identity="${3:?Pass the Functions runtime service account email}"
region="us-central1"
worker_identity="earlyworld-media@${project}.iam.gserviceaccount.com"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com transcoder.googleapis.com iamcredentials.googleapis.com --project="$project"
if ! gcloud iam service-accounts describe "$worker_identity" --project="$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create earlyworld-media --display-name='earlyworld private media worker' --project="$project"
fi
for role in roles/datastore.user roles/transcoder.admin; do
  gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$worker_identity" --role="$role" --condition=None >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$bucket" --member="serviceAccount:$worker_identity" --role=roles/storage.objectAdmin >/dev/null
project_number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
# Storage must publish finalized-object events to Eventarc/Pub/Sub.
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:service-${project_number}@gs-project-accounts.iam.gserviceaccount.com" --role=roles/pubsub.publisher --condition=None >/dev/null
# Noninteractive Firebase rules deployment skips this cross-service IAM setup.
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:service-${project_number}@gcp-sa-firebasestorage.iam.gserviceaccount.com" --role=roles/firebaserules.firestoreServiceAgent --condition=None >/dev/null
# Functions sign authorized read URLs and purge originals/processed objects.
gcloud storage buckets add-iam-policy-binding "gs://$bucket" --member="serviceAccount:$functions_identity" --role=roles/storage.objectAdmin >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$functions_identity" --member="serviceAccount:$functions_identity" --role=roles/iam.serviceAccountTokenCreator --project="$project" >/dev/null
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$functions_identity" --role=roles/transcoder.viewer --condition=None >/dev/null
gcloud run deploy earlyworld-media --source=services/media-worker --project="$project" --region="$region" --service-account="$worker_identity" --no-allow-unauthenticated --min-instances=0 --max-instances=1 --concurrency=1 --cpu=1 --memory=1Gi --timeout=300 --set-env-vars="GOOGLE_CLOUD_PROJECT=$project,MEDIA_BUCKET=$bucket"
gcloud run services add-iam-policy-binding earlyworld-media --project="$project" --region="$region" --member="serviceAccount:$functions_identity" --role=roles/run.invoker >/dev/null
gcloud run services describe earlyworld-media --project="$project" --region="$region" --format='value(status.url)'
