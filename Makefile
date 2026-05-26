# UK Energy & Carbon Insights — top-level convenience targets.
#
# Reviewer-facing one-liners that delegate to the underlying npm/SAM/AWS
# commands. Run `make help` (the default target) to discover everything.

.DEFAULT_GOAL := help

.PHONY: help install dev docker-down test validate \
        ssm-put-gemini sam-config \
        sam-build sam-local sam-deploy web-build web-deploy deploy \
        clean

# --- discovery ---------------------------------------------------------------

help: ## Show this menu
	@printf "\n\033[1mUK Energy & Carbon Insights — make targets\033[0m\n\n"
	@grep -E '^[a-zA-Z][a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
	  | awk -F'[:#]' '{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$NF}' \
	  | sort
	@printf "\nUsage hints:\n"
	@printf "  Local dev (docker):    make install && make dev\n"
	@printf "  Local dev (sam):       make install && make sam-build && make sam-local\n"
	@printf "  Full AWS deploy:       make install && make ssm-put-gemini KEY=AIza... && make sam-config && make deploy\n\n"

# --- setup -------------------------------------------------------------------

install:  ## Install all workspace dependencies (npm ci)
	npm ci

ssm-put-gemini:  ## Put the Gemini API key into SSM SecureString (use KEY=AIza...)
	@test -n "$(KEY)" || (echo "❌ KEY is required. Usage: make ssm-put-gemini KEY=AIza..." && exit 1)
	aws ssm put-parameter \
	  --name /uk-energy/dev/GEMINI_API_KEY \
	  --type SecureString \
	  --value "$(KEY)" \
	  --overwrite \
	  --region eu-west-2

sam-config:  ## Copy the SAM config template (gitignored stack-specific overrides)
	cp -n infrastructure/samconfig.toml.example infrastructure/samconfig.toml || \
	  echo "⚠️  infrastructure/samconfig.toml already exists — not overwriting"

# --- local development -------------------------------------------------------

dev:  ## Run the full stack locally with docker compose (API + SPA)
	npm run docker:up

docker-down:  ## Stop docker compose stack
	npm run docker:down

sam-local:  ## Run the API via `sam local start-api` (port 3000)
	npm run sam:local

# --- quality gates -----------------------------------------------------------

test:  ## Run the full test suite (148 backend + frontend tests)
	npm test

validate:  ## Run prettier + eslint + typecheck + tests
	npm run validate

# --- build + deploy ----------------------------------------------------------

sam-build:  ## SAM build (Lambda bundle via Makefile builder)
	npm run sam:build

sam-deploy:  ## SAM deploy (requires `make sam-config` first)
	npm run sam:deploy

web-build:  ## Build the SPA into apps/web/dist/
	npm run build:web

web-deploy:  ## Sync apps/web/dist → S3 + invalidate CloudFront
	npm run deploy:web

deploy: sam-build sam-deploy web-build web-deploy  ## Full deploy: API + Web in one go

# --- cleanup -----------------------------------------------------------------

clean:  ## Remove .aws-sam/ + apps/web/dist/
	rm -rf .aws-sam apps/web/dist
