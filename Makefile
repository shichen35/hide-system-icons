NAME = hide-system-icons
DOMAIN = shichen35.github.io
UUID = $(NAME)@$(DOMAIN)
EXT_DIR = ~/.local/share/gnome-shell/extensions/$(UUID)

VERSION := $(shell node -p "require('./package.json').version")

MODERN_ZIP = $(NAME)-$(VERSION)-gnome-45-51.zip
LEGACY_ZIP = $(NAME)-$(VERSION)-gnome-40-44.zip
SCHEMAS = schemas/gschemas.compiled
EXTRAS = README.md LICENSE

.PHONY: all pack pack-modern pack-legacy install install-modern install-legacy clean

all: pack

node_modules: package.json
	npm install

dist/extension.js dist/prefs.js: node_modules $(wildcard *.ts)
	node_modules/typescript/bin/tsc

$(SCHEMAS): schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(MODERN_ZIP): dist/extension.js dist/prefs.js $(SCHEMAS) metadata.json package.json
	@cp -r schemas dist/
	@node scripts/stamp-metadata.mjs metadata.json dist/metadata.json
	@rm -f dist/schemas/gschemas.compiled
	@cp -f $(EXTRAS) dist/ 2>/dev/null || true
	@rm -f $@ && cd dist && zip -9r ../$@ .

$(LEGACY_ZIP): $(SCHEMAS) legacy/extension.js legacy/prefs.js legacy/metadata.json package.json
	@rm -rf legacy-dist && mkdir -p legacy-dist
	@cp legacy/extension.js legacy/prefs.js legacy-dist/
	@node scripts/stamp-metadata.mjs legacy/metadata.json legacy-dist/metadata.json
	@cp -r schemas legacy-dist/
	@cp -f $(EXTRAS) legacy-dist/ 2>/dev/null || true
	@rm -f $@ && cd legacy-dist && zip -9r ../$@ .

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
	@glib-compile-schemas $(EXT_DIR)/schemas/

clean:
	@rm -rf dist legacy-dist node_modules $(NAME)-*.zip
