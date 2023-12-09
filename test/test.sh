#!/bin/bash

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

act push -W test/workflows/ --network test-network

# TODO implement tests

docker stop openssh-server
docker rm openssh-server