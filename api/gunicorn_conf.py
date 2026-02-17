# Eventlet worker required for Flask-SocketIO WebSocket support.
# Single worker keeps all WebSocket connections on the same process.
worker_class = "eventlet"
workers = 1
bind = "0.0.0.0:5000"
