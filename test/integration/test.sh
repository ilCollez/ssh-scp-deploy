#!/bin/bash
# Integration test: spins up an OpenSSH container and runs the action against it via `act`.
# Requires: docker, act (https://github.com/nektos/act)

set -euo pipefail

cleanup() {
    docker stop openssh-server >/dev/null 2>&1 || true
    docker rm openssh-server >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network inspect test-network >/dev/null 2>&1 || \
    docker network create --driver bridge test-network

docker run -d \
  --name=openssh-server \
  --hostname=test-server \
  --net=test-network \
  -e PUID=1000 \
  -e PGID=1000 \
  -e USER_NAME=test-user \
  -e USER_PASSWORD=test-password \
  -e PASSWORD_ACCESS=true \
  -p 2222:2222 \
  lscr.io/linuxserver/openssh-server:latest

# wait for sshd to be ready
for i in {1..30}; do
    if docker exec openssh-server pgrep sshd >/dev/null 2>&1; then break; fi
    sleep 1
done

act push -W test/integration/workflows/ --network test-network
