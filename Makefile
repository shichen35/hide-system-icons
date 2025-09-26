NAME=hide-system-icons
DOMAIN=shichen35.github.io
MODERN_ZIP=$(NAME)-gnome-45-49.zip
LEGACY_ZIP=$(NAME)-gnome-40-44.zip

.PHONY: all pack pack-modern pack-legacy install install-modern install-legacy clean

all: dist/extension.js

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules
	node_modules/typescript/bin/tsc

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

# Modern ESM package for GNOME 45–49
$(MODERN_ZIP): dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@cp -r schemas dist/
	@cp metadata.json dist/
	@cp -f icon.png dist/ 2>/dev/null || true
	@cp -f README.md LICENSE dist/ 2>/dev/null || true
	@(cd dist && zip ../$(MODERN_ZIP) -9r .)

# Legacy package for GNOME 40–44
$(LEGACY_ZIP): schemas/gschemas.compiled legacy/extension.js legacy/prefs.js legacy/metadata.json
	@rm -rf legacy-dist
	@mkdir -p legacy-dist
	@cp legacy/extension.js legacy-dist/extension.js
	@cp legacy/prefs.js legacy-dist/prefs.js
	@cp -r schemas legacy-dist/
	@cp legacy/metadata.json legacy-dist/metadata.json
	@cp -f icon.png legacy-dist/ 2>/dev/null || true
	@cp -f README.md LICENSE legacy-dist/ 2>/dev/null || true
	@(cd legacy-dist && zip ../$(LEGACY_ZIP) -9r .)

pack: $(MODERN_ZIP) $(LEGACY_ZIP)

pack-modern: $(MODERN_ZIP)

pack-legacy: $(LEGACY_ZIP)

install: install-modern

install-modern: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/*
	@cp -r dist/* ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/

install-legacy: $(LEGACY_ZIP)
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)/*
	@unzip -o $(LEGACY_ZIP) -d ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)

clean:
	@rm -rf dist legacy-dist node_modules $(MODERN_ZIP) $(LEGACY_ZIP)
