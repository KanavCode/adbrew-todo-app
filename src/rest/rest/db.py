"""MongoDB connection management.

The connection settings come from the environment variables defined in the Dockerfile
(``MONGO_HOST`` / ``MONGO_PORT``), so the same code runs unchanged in every container setup.
"""
import os
from functools import lru_cache

from pymongo import MongoClient

DATABASE_NAME = 'test_db'

# Fail fast when Mongo is down so the API can answer with a 503 instead of hanging for
# pymongo's default 30 seconds.
SERVER_SELECTION_TIMEOUT_MS = 3000


def build_mongo_uri():
    return 'mongodb://{host}:{port}'.format(
        host=os.environ['MONGO_HOST'],
        port=os.environ['MONGO_PORT'],
    )


@lru_cache(maxsize=None)
def get_client():
    """Return the process-wide MongoClient (thread-safe, created lazily on first use)."""
    return MongoClient(
        build_mongo_uri(),
        tz_aware=True,
        serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
    )


def get_database(name=DATABASE_NAME):
    return get_client()[name]
