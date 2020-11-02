FROM node:buster-slim AS build
WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN npm i

COPY . .

RUN npm run build



FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
COPY env/nginx.conf /etc/nginx/conf.d/default.conf
COPY env/entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/entrypoint.sh
RUN ln -sf /dev/stdout /var/log/nginx/access.log; ln -sf /dev/stderr /var/log/nginx/error.log

ENTRYPOINT ["entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]