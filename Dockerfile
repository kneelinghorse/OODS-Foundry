# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends tar ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Release verification can install the exact frozen tarball from a minimal build context.
ARG OODS_PACKAGE=@oods/foundry@0.8.0
RUN --mount=type=bind,target=/input npm install --global "${OODS_PACKAGE}" \
 && npm cache clean --force
RUN mkdir /data && chown node:node /data
ENV OODS_FOUNDRY_HOME=/data
USER node
WORKDIR /data
VOLUME ["/data"]
ENTRYPOINT ["oods-foundry"]
