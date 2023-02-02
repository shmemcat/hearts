#!/bin/bash

# catch up with git changes
git pull

# catch up with package changes
npm install

# build the app
npm run build

# stop the server
pm2 stop 0

# start the server
pm2 start npm -- start