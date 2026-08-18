VERSION ?= 0.1.4
TAG ?= v$(VERSION)
BUILD_DIR ?= dist
RELEASE_DIR ?= release-assets

.PHONY: all build build-frontend build-backend package release-tag clean dev

all: build

## 🎨 Build React Vite frontend
build-frontend:
	npm install
	npm run build

## 🔨 Compile Go backend binary
build-backend:
	CGO_ENABLED=0 go build -ldflags="-s -w -X 'main.Version=$(TAG)'" -o akpanel main.go

## 🚀 Build both Frontend & Backend
build: build-frontend build-backend
	@echo "✨ Build completed successfully! Binary: ./akpanel"

## 📦 Package Release Bundles (AMD64 & ARM64)
package: build-frontend
	@rm -rf $(BUILD_DIR) $(RELEASE_DIR)
	@mkdir -p $(BUILD_DIR)/amd64 $(BUILD_DIR)/arm64 $(RELEASE_DIR)
	@echo "🔨 Cross-compiling for linux/amd64..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w -X 'main.Version=$(TAG)'" -o $(BUILD_DIR)/amd64/akpanel main.go
	@echo "🔨 Cross-compiling for linux/arm64..."
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w -X 'main.Version=$(TAG)'" -o $(BUILD_DIR)/arm64/akpanel main.go
	@for ARCH in amd64 arm64; do \
		BUNDLE="$(BUILD_DIR)/akpanel-$(TAG)-linux-$$ARCH"; \
		mkdir -p "$$BUNDLE/resources"; \
		cp "$(BUILD_DIR)/$$ARCH/akpanel" "$$BUNDLE/akpanel"; \
		chmod +x "$$BUNDLE/akpanel"; \
		cp -r public "$$BUNDLE/"; \
		cp -r resources/views "$$BUNDLE/resources/"; \
		cp -r config "$$BUNDLE/"; \
		cp -r database "$$BUNDLE/"; \
		cp .env.example "$$BUNDLE/.env.example"; \
		cp LICENSE "$$BUNDLE/LICENSE"; \
		cp README.md "$$BUNDLE/README.md"; \
		[ -f install.sh ] && cp install.sh "$$BUNDLE/install.sh"; \
		tar -czf "$(RELEASE_DIR)/akpanel_$(TAG)_linux_$$ARCH.tar.gz" -C "$$BUNDLE" .; \
		echo "✓ Packaged $(RELEASE_DIR)/akpanel_$(TAG)_linux_$$ARCH.tar.gz"; \
	done
	@cp install.sh $(RELEASE_DIR)/install.sh 2>/dev/null || true
	@cd $(RELEASE_DIR) && sha256sum akpanel_*.tar.gz install.sh > checksums.txt
	@echo "🎉 Packaging complete! Files in $(RELEASE_DIR)/"

## 🏷️ Create & Push a Git Release Tag (e.g. make release-tag VERSION=0.1.0)
release-tag:
	@echo "Creating Git Tag $(TAG)..."
	git tag -a $(TAG) -m "AKpanel Release $(TAG)"
	git push origin $(TAG)
	@echo "🚀 Tag $(TAG) pushed! GitHub Actions will build the release automatically."

## 🧹 Clean build artifacts
clean:
	@rm -rf $(BUILD_DIR) $(RELEASE_DIR) akpanel akpanel-bin public/build
	@echo "🧹 Cleaned all build artifacts."
