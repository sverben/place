FROM node:16

RUN useradd -U -u 1003 place
RUN mkdir /app && chown place:place /app

WORKDIR /app
USER place

COPY package*.json ./

RUN npm ci

COPY . /app/

CMD [ "npm", "start" ]