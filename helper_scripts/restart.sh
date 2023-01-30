#!/bin/bash

# stop the server
pm2 stop 0

# catch up with package changes
npm install

# build the app
npm run build

# start the server
pm2 start npm -- start