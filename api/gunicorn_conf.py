# Gunicorn config: eventlet worker required for Flask-SocketIO (sync worker + eventlet causes Bad file descriptor).
# Use 1 worker so WebSocket connections stay on the same process.
worker_class = "eventlet"
workers = 1
bind = "0.0.0.0:5000"
