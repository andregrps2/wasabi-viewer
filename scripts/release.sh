#!/usr/bin/env bash
set -euo pipefail

# Wasabi Viewer release helper
# Builds the installer for a given version and uploads it to GitHub Releases.

REPO="dioguera012/wasabi-viewer"

usage() {
  echo "Usage: $(basename "$0") <version>"
  echo "Example: $(basename "$0") 1.0.10"
}

if [[ ${1:-} == "" ]]; then
  usage
  exit 1
fi

VERSION="$1"

# Basic semver check (x.y.z)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in x.y.z format (e.g., 1.0.10)" >&2
  exit 1
fi

# Check required tools
for cmd in node npm gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: '$cmd' not found in PATH" >&2
    exit 1
  fi
done

echo "==> Updating package.json version to $VERSION"
node -e '
const fs=require("fs");
const path="package.json";
const v=process.argv[1];
const pkg=JSON.parse(fs.readFileSync(path,"utf8"));
pkg.version=v;
pkg.build=pkg.build||{};
pkg.build.buildVersion=v;
fs.writeFileSync(path,JSON.stringify(pkg,null,2)+"\n");
' "$VERSION"

echo "==> Building installer via npm run dist"
npm run dist

ART_DIR="dist/setups/$VERSION"
ASSET="${ART_DIR}/Wasabi Viewer Setup ${VERSION}.exe"

if [[ ! -f "$ASSET" ]]; then
  echo "Error: installer not found at: $ASSET" >&2
  exit 1
fi

echo "==> Ensuring release v$VERSION exists"
if ! gh release view "v$VERSION" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "v$VERSION" \
    --repo "$REPO" \
    --title "Wasabi Viewer $VERSION" \
    --notes "Release $VERSION: build automático e upload de instalador."
fi

echo "==> Uploading asset: $ASSET"
gh release upload "v$VERSION" "$ASSET" --repo "$REPO" --clobber

URL=$(gh release view "v$VERSION" --repo "$REPO" --json url -q .url)
echo "==> Done. Release URL: $URL"