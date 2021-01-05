FROM	node:14 AS builder

RUN	mkdir -p /usr/src/app/

WORKDIR	/usr/src/app

COPY	package*.json /usr/src/app/

RUN	npm install

COPY	. /usr/src/app/

RUN	node_modules/.bin/tsc

FROM	node:14

LABEL	org.opencontainers.image.source https://github.com/WoltLab/blacklist

RUN	mkdir -p /usr/src/app/

WORKDIR	/usr/src/app

COPY	package*.json /usr/src/app/

RUN	npm install --production

COPY	--from=builder /usr/src/app/dist/ /usr/src/app/dist/

ENTRYPOINT [ "node", "/usr/src/app/dist/index.js" ]
