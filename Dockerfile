FROM node:16

WORKDIR /app
COPY package*.json ./

RUN addgroup --gid 1003 place
RUN useradd -U -u 1003 place
USER place
RUN npm ci

COPY . /app/

CMD [ "npm", "start" ]