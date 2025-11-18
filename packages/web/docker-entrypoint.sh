#!/bin/sh
set -e

# Set default GRAPHQL_BACKEND_URL if not provided
export GRAPHQL_BACKEND_URL=${GRAPHQL_BACKEND_URL:-http://graphdone-server:4127/graphql}

# Substitute environment variables in nginx template
envsubst '${GRAPHQL_BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
