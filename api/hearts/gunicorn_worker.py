"""
Custom Gunicorn worker that treats "no URI read" (client disconnect before
sending a request) as debug-only, avoiding ERROR logs for benign disconnects.
"""

import logging

from gunicorn.workers.sync import SyncWorker

logger = logging.getLogger(__name__)


class QuietSyncWorker(SyncWorker):
    def handle(self, listener, client, addr):
        try:
            super().handle(listener, client, addr)
        except (
            StopIteration,
            ConnectionError,
            BrokenPipeError,
            EOFError,
            OSError,
        ) as e:
            # Client closed connection before sending a full request; log at debug only
            logger.debug("Client disconnect before request: %s", e)
