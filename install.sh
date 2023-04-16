#!/bin/bash

EXTENSION_PATH="$HOME/.local/share/gnome-shell/extensions/volume-mixer@charlieqle"

rm -r "$EXTENSION_PATH" 2> /dev/null
if [ -d "./src/schemas" ]; then
    glib-compile-schemas "./src/schemas/"
fi
cp -r "./src" "$EXTENSION_PATH" && echo "Log out and log back in to load extension!"
