.PHONY: build-ApiFunction

build-ApiFunction:
	@if [ -z "$$PROJECT_ROOT" ]; then echo "PROJECT_ROOT env var is required (set by npm run sam:build)"; exit 1; fi
	cd "$$PROJECT_ROOT" && npm install --silent --no-audit --no-fund
	cd "$$PROJECT_ROOT" && npx esbuild apps/api/src/api.ts \
	  --bundle \
	  --platform=node \
	  --target=es2022 \
	  --format=esm \
	  --outfile=$(ARTIFACTS_DIR)/api.mjs \
	  --external:@aws-sdk/* \
	  --external:aws-sdk \
	  --sourcemap \
	  --minify \
	  --banner:js="import { createRequire as topLevelCreateRequire } from 'module'; const require = topLevelCreateRequire(import.meta.url);"
	mkdir -p $(ARTIFACTS_DIR)/prompts/v1
	cp "$$PROJECT_ROOT"/apps/api/src/prompts/v1/*.md $(ARTIFACTS_DIR)/prompts/v1/
	echo '{"type":"module"}' > $(ARTIFACTS_DIR)/package.json
