#!/bin/sh

if [ $APIBASEURL ]; then
  echo "Setting API Base Url: $APIBASEURL"
  sed -i "s|{APIBASEURL}|$APIBASEURL|g" *.js
fi

sed -i "s|\$PORT|$PORT|g" /etc/nginx/conf.d/default.conf

exec "$@"