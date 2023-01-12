#!/bin/bash

# Get the process ID of the script we want to stop
pid=$(forever list | grep "index.js" | awk '{print $7}')

# Stop the script
forever stop $pid

# Start the server
forever start hearts/index.js