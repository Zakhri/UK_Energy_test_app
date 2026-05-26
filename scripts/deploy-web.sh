#!/usr/bin/env bash
# deploy-web.sh — push the React SPA to S3 + invalidate the CloudFront cache.
#
# Reads stack outputs from CloudFormation, then runs:
#   1. aws s3 sync apps/web/dist s3://<bucket> --delete
#   2. aws cloudfront create-invalidation --distribution-id <id> --paths '/*'
#
# Prereqs:
#   - npm run build:web   (apps/web/dist must exist)
#   - sam deploy            (stack must already exist; we read its outputs)
#   - AWS credentials on $PATH
#
# Usage:
#   npm run deploy:web
#   STACK_NAME=uk-energy-insights-prod npm run deploy:web

set -euo pipefail

STACK_NAME="${STACK_NAME:-uk-energy-insights-dev}"
DIST_DIR="${DIST_DIR:-apps/web/dist}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "❌ $DIST_DIR not found. Run 'npm run build:web' first." >&2
  exit 1
fi

echo "▶ Reading outputs from stack '$STACK_NAME'…"
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output json)

BUCKET=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebBucketName") | .OutputValue')
DIST_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebDistributionId") | .OutputValue')
URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CloudFrontUrl") | .OutputValue')

if [[ -z "$BUCKET" || -z "$DIST_ID" ]]; then
  echo "❌ Stack '$STACK_NAME' is missing WebBucketName / WebDistributionId outputs." >&2
  echo "   Did 'sam deploy' finish successfully with the latest template?" >&2
  exit 1
fi

echo "▶ Syncing $DIST_DIR → s3://$BUCKET …"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete

echo "▶ Invalidating CloudFront distribution $DIST_ID …"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths '/*' \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output table

echo
echo "✅ Done. Live at: $URL"
