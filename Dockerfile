FROM node:14

WORKDIR src/

COPY package*.json ./

COPY prisma ./prisma/

COPY .env ./

RUN npm install

RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD [ "npm", "start" ]