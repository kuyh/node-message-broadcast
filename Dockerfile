FROM node:12.13-slim as builder

#RUN apt-get update && \
#  apt-get install -y --no-install-recommends vim-tiny && \
#  apt-get clean && apt-get purge -y && \
#  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json /app/package.json
COPY node_modules /app/node_modules

RUN npm set strict-ssl false && npm install --prod

ENV INSIDE_DOCKER 1
COPY index.js /app/

FROM astefanutti/scratch-node
COPY --from=builder /app /

EXPOSE 3000
ENTRYPOINT ["node", "index.js"]
