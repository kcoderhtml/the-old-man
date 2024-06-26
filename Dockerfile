# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM kcoderhtml/bun-node-base as base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
RUN chown -R bun:bun node_modules
COPY --from=prerelease /usr/src/app/bag bag
COPY --from=prerelease /usr/src/app/welcome.ts .
COPY --from=prerelease /usr/src/app/scheduler.ts .
COPY --from=prerelease /usr/src/app/index.ts .
COPY --from=prerelease /usr/src/app/package.json .
# make data directory
RUN mkdir -p data
RUN chown -R bun:bun data

# pull the items.yaml file from the bag
USER bun
RUN cd data && wget https://raw.githubusercontent.com/rivques/bag-manifest/production/items.yaml && chown -R bun:bun items.yaml && cd ..
RUN touch data/jobs.json && chown -R bun:bun data/jobs.json && cd ..

# run the app
USER bun
EXPOSE 3000/tcp
EXPOSE 3001/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
