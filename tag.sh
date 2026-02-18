#!/usr/bin/env bash
set -e

latest=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
IFS='.' read -r major minor patch <<< "${latest#v}"

echo "Current version: $latest"
echo "  1) patch  → v$major.$minor.$((patch + 1))"
echo "  2) minor  → v$major.$((minor + 1)).0"
echo "  3) major  → v$((major + 1)).0.0"
printf "Bump [1/2/3]: "
read -r choice

case $choice in
  1) patch=$((patch + 1)) ;;
  2) minor=$((minor + 1)); patch=0 ;;
  3) major=$((major + 1)); minor=0; patch=0 ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

new_tag="v$major.$minor.$patch"
git tag "$new_tag"
echo "Created tag: $new_tag"
echo "Run 'grpush' to push tags to origin."
