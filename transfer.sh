#!/usr/bin/env bash

set -e

# A script to copy the module into a Foundry data directory.

if [[ $# -eq 0 ]]; then
    echo "No arguments provided. Usage: ./transfer.sh <path_to_user_Data_dir>"
    exit 1
fi

echo "Building..."
npm run build

echo "Removing existing module..."
rm -rf "${1}/modules/polmap"

echo "Transferring..."
mkdir -p "${1}/modules/polmap"
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.idea/*' -not -iname 'transfer.sh' -not -iname '.*' -not -iname 'package*.json' -exec cp --parents '{}' "${1}/modules/polmap" \;
echo "Done!"
