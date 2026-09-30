#!/bin/sh
# Copy the art thread's pixel kit and sprites into the app. ART_DIR defaults to the project's shared art folder.
set -e
ART="${ART_DIR:-/mnt/project-files/daybook-art}"
cd "$(dirname "$0")/.."
cp "$ART"/ui/daybook-ui.css "$ART"/ui/erdtree-*.png "$ART"/ui/icons.mjs src/ui/
cp "$ART"/ui/sprite.js src/game/sprite.js
cp "$ART"/hero-data.json "$ART"/items-data.json src/game/
echo "Synced art from $ART"
