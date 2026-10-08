# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends tar ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# OODS_PACKAGE can name another version, or a package tarball in the build context as /input/<file>.tgz.
ARG OODS_PACKAGE=@oods/foundry@0.10.1
RUN --mount=type=bind,target=/input npm install --global "${OODS_PACKAGE}" \
 && npm cache clean --force
RUN mkdir /data && chown node:node /data
ENV OODS_FOUNDRY_HOME=/data
USER node
WORKDIR /data
VOLUME ["/data"]
ENTRYPOINT ["oods-foundry"]
