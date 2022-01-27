FROM node
WORKDIR /build
COPY db /build/db
COPY src /build/src
COPY package.json /build/
COPY package-lock.json /build/

RUN apt update && apt install sqlite3 \
    && apt clean && find /var/lib/apt/lists -type f -delete

RUN npm i
RUN npm run recreate-db
RUN npm run insert-products
RUN npm i nodemon
CMD npm run dev
