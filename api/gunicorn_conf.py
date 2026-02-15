# Gunicorn config: use custom worker to avoid ERROR logs for client disconnects
worker_class = "hearts.gunicorn_worker.QuietSyncWorker"
bind = "0.0.0.0:5000"
