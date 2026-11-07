#!/bin/sh
# End-to-end check of the one-line installer's code download (#243).
#
# Runs scripts/install.sh non-interactively in a disposable container and
# stops it right after the code step (GRAPHDONE_INSTALL_STOP_AFTER=clone), so
# nothing is installed or started. It proves that:
#   1. a fresh install clones GRAPHDONE_REF (default main) and lands on the
#      commit the remote has for it;
#   2. re-running updates the installer-managed checkout in place;
#   3. an old install stranded on a branch deleted upstream (fix/first-start)
#      is moved to GRAPHDONE_REF instead of failing on `git pull`;
#   4. every setup-script fallback URL the installer reports answers HTTP 200.
#
# Docker on the host is only used to run the container. Inside it, `docker`
# is a stub that reports a running daemon so the dependency check passes.
#
# Usage:  sh tests/integration/installer-container.sh
#   GRAPHDONE_REF=<branch|tag>   ref to install (default main)
#   INSTALLER_UNDER_TEST=<path>  installer to run (default scripts/install.sh)
set -eu

IMAGE="node:22.18.0-trixie-slim"
MOUNT=/opt/graphdone-installer-test

if [ "${1:-}" != "--inside" ]; then
    root="$(cd "$(dirname "$0")/../.." && pwd)"
    installer="${INSTALLER_UNDER_TEST:-$root/scripts/install.sh}"
    installer="$(cd "$(dirname "$installer")" && pwd)/$(basename "$installer")"
    name="graphdone-installer-test-$$"
    trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT INT TERM
    docker run --rm --name "$name" \
        -e GRAPHDONE_REF="${GRAPHDONE_REF:-main}" \
        -e TERM=xterm \
        -v "$installer:$MOUNT/install.sh:ro" \
        -v "$root/tests/integration/installer-container.sh:$MOUNT/test.sh:ro" \
        "$IMAGE" sh "$MOUNT/test.sh" --inside
    exit $?
fi

# ── Inside the container ────────────────────────────────────────────────────
REF="$GRAPHDONE_REF"
INSTALL_DIR="$HOME/graphdone"
REPO_URL="https://github.com/GraphDone/GraphDone-Core.git"
failures=0

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }

apt-get -qq -o Acquire::Retries=3 update >/dev/null
DEBIAN_FRONTEND=noninteractive apt-get -qq -o Acquire::Retries=3 install -y --no-install-recommends \
    git curl ca-certificates sudo openssl ncurses-bin >/dev/null

cat > /usr/local/bin/docker <<'EOF'
#!/bin/sh
case "$1" in
    --version) echo "Docker version 27.0.0, build test-stub" ;;
esac
exit 0
EOF
chmod +x /usr/local/bin/docker

# The commit the remote has for REF: a branch head or a (peeled) tag.
remote_sha=$(git ls-remote --heads --tags "$REPO_URL" | awk -v r="$REF" '
    { sha[$2] = $1 }
    END {
        if (("refs/heads/" r) in sha) print sha["refs/heads/" r]
        else if (("refs/tags/" r "^{}") in sha) print sha["refs/tags/" r "^{}"]
        else if (("refs/tags/" r) in sha) print sha["refs/tags/" r]
    }')
if [ -n "$remote_sha" ]; then
    pass "ref '$REF' exists on $REPO_URL at $remote_sha"
else
    fail "ref '$REF' does not exist on $REPO_URL"
fi

run_installer() {
    label="$1"
    log="/tmp/installer-$label.log"
    if (cd /tmp && GRAPHDONE_INSTALL_STOP_AFTER=clone sh "$MOUNT/install.sh" </dev/null >"$log" 2>&1); then
        pass "installer exited 0 ($label)"
    else
        fail "installer exited non-zero ($label); last lines:"
        tail -25 "$log" | sed 's/\x1b\[[0-9;?]*[A-Za-z]//g'
        return 1
    fi
}

check_checkout() {
    label="$1"
    head_sha=$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || echo none)
    if [ "$head_sha" = "$remote_sha" ]; then
        pass "$INSTALL_DIR is at $REF $remote_sha ($label)"
    else
        fail "$INSTALL_DIR HEAD $head_sha is not $REF $remote_sha ($label)"
    fi
    if git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/heads/$REF"; then
        branch=$(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD)
        if [ "$branch" = "$REF" ]; then pass "checked out branch $REF ($label)"; else fail "checked out '$branch', expected $REF ($label)"; fi
    fi
    # The same marker the installer uses to recognise a GraphDone checkout.
    if grep -q '"name": "graphdone"' "$INSTALL_DIR/package.json" 2>/dev/null; then
        pass "clone is a GraphDone checkout ($label)"
    else
        fail "clone has no GraphDone package.json ($label)"
    fi
}

if run_installer fresh; then
    check_checkout fresh

    if run_installer update; then
        if grep -q "Update existing" /tmp/installer-update.log; then pass "second run took the update path"; else fail "second run did not take the update path"; fi
        check_checkout update
    fi

    # An install made by the old installer: a local fix/first-start branch whose
    # upstream was deleted, one commit behind.
    git -C "$INSTALL_DIR" checkout -q -b fix/first-start HEAD~1
    git -C "$INSTALL_DIR" config branch.fix/first-start.remote origin
    git -C "$INSTALL_DIR" config branch.fix/first-start.merge refs/heads/fix/first-start
    if run_installer stranded; then
        check_checkout "stranded on fix/first-start"
    fi
fi

# Setup-script fallbacks, exactly as the installer would fetch them.
sources=$(sh "$MOUNT/install.sh" sources) || { fail "installer 'sources' command failed"; sources=""; }
if echo "$sources" | grep -qx "ref $REF"; then pass "installer reports ref $REF"; else fail "installer does not report ref $REF"; fi
urls=$(echo "$sources" | awk '$1 == "setup-script" {print $2}')
[ -n "$urls" ] || fail "installer reported no setup-script URLs"
for url in $urls; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --retry 3 --max-time 30 "$url" || echo 000)
    if [ "$code" = 200 ]; then pass "HTTP 200 $url"; else fail "HTTP $code $url"; fi
done

if [ "$failures" -ne 0 ]; then
    printf '\n%s installer check(s) failed\n' "$failures"
    exit 1
fi
printf '\nAll installer checks passed for ref %s\n' "$REF"
