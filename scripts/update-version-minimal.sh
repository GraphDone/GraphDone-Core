#!/bin/bash
# Set the release version everywhere it is recorded.
#
#   scripts/update-version-minimal.sh 0.4.0-alpha
#
# Manifests and their package-lock.json entries are edited in place (no
# re-resolution); the remaining copies (runtime-reported versions, local image
# tags, installer fallback, README badge) are listed in
# tests/toolchain/version-contract.mjs, which fails CI if any of them is missed.
set -euo pipefail

NEW_VERSION="${1:-}"
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$ ]]; then
    echo "Usage: $0 <MAJOR.MINOR.PATCH[-suffix]>   e.g. $0 0.4.0-alpha" >&2
    exit 1
fi
cd "$(dirname "$0")/.."

OLD_VERSION="$(node -p "require('./package.json').version")"
echo "Updating version $OLD_VERSION -> $NEW_VERSION"

# 1. Root and workspace manifests, plus their entries in package-lock.json.
#    Only the version fields change: re-resolving the lockfile (npm version,
#    npm install) would also rewrite unrelated dev/peer flags.
NEW_VERSION="$NEW_VERSION" node - <<'NODE'
const fs = require('fs');
const version = process.env.NEW_VERSION;
const edit = (file, change) => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(json);
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};
const workspaces = fs.readdirSync('packages').filter(dir => fs.existsSync(`packages/${dir}/package.json`));
edit('package.json', json => { json.version = version; });
for (const dir of workspaces) edit(`packages/${dir}/package.json`, json => { json.version = version; });
edit('package-lock.json', lock => {
  lock.version = version;
  lock.packages[''].version = version;
  for (const dir of workspaces) if (lock.packages[`packages/${dir}`]) lock.packages[`packages/${dir}`].version = version;
});
NODE

# 2. Every other recorded copy of the old version (exact-string replacement).
replace() { # file old new
    OLD="$2" NEW="$3" perl -0pi -e 's/\Q$ENV{OLD}\E/$ENV{NEW}/g' "$1"
}
for file in \
    packages/web/src/utils/version.ts \
    packages/web/.env.example \
    packages/mcp-server/src/index.ts \
    packages/mcp-server/src/health-server.ts \
    packages/mcp-server/tests/health-server.test.ts \
    packages/mcp-server/tests/neo4j-contract.test.ts \
    packages/server/src/index.ts \
    scripts/install.sh \
    deployment/docker-compose.yml \
    deployment/docker-compose.http.yml; do
    replace "$file" "$OLD_VERSION" "$NEW_VERSION"
done
replace README.md "badge/version-${OLD_VERSION//-/--}-" "badge/version-${NEW_VERSION//-/--}-"

node --test tests/toolchain/version-contract.mjs >/dev/null
echo "Version $NEW_VERSION recorded everywhere (tests/toolchain/version-contract.mjs passes)."
