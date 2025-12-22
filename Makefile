NAME = hide-system-icons
DOMAIN = shichen35.github.io
UUID = $(NAME)@$(DOMAIN)
EXT_DIR = ~/.local/share/gnome-shell/extensions/$(UUID)

MODERN_ZIP = $(NAME)-gnome-45-49.zip
LEGACY_ZIP = $(NAME)-gnome-40-44.zip
SCHEMAS = schemas/gschemas.compiled
EXTRAS = icon.png README.md LICENSE

.PHONY: all pack pack-modern pack-legacy install install-modern install-legacy clean

all: pack

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules
	node_modules/typescript/bin/tsc

$(SCHEMAS): schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(MODERN_ZIP): dist/extension.js dist/prefs.js $(SCHEMAS)
	@cp -r schemas metadata.json dist/
	@cp -f $(EXTRAS) dist/ 2>/dev/null || true
	@cd dist && zip -9r ../$@ .

$(LEGACY_ZIP): $(SCHEMAS) legacy/extension.js legacy/prefs.js legacy/metadata.json
	@rm -rf legacy-dist && mkdir -p legacy-dist
	@cp legacy/extension.js legacy/prefs.js legacy/metadata.json legacy-dist/
	@cp -r schemas legacy-dist/
	@cp -f $(EXTRAS) legacy-dist/ 2>/dev/null || true
	@cd legacy-dist && zip -9r ../$@ .

pack: $(MODERN_ZIP) $(LEGACY_ZIP)
pack-modern: $(MODERN_ZIP)
pack-legacy: $(LEGACY_ZIP)

install: install-modern

install-modern install-legacy: SRC = $(if $(findstring legacy,$@),legacy-dist,dist)
install-modern: $(MODERN_ZIP)
install-legacy: $(LEGACY_ZIP)
install-modern install-legacy:
	@rm -rf $(EXT_DIR) && mkdir -p $(EXT_DIR)
	@cp -r $(SRC)/* $(EXT_DIR)/

clean:
	@rm -rf dist legacy-dist node_modules $(MODERN_ZIP) $(LEGACY_ZIP)
