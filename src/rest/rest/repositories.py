"""Persistence layer for todos.

``TodoRepository`` is the only place that knows todos are stored in MongoDB. Views depend on its
two methods (``add`` / ``list_all``), so the storage engine can be swapped or faked in tests
without touching the HTTP layer.
"""
import logging
from datetime import datetime, timezone

from pymongo import ASCENDING
from pymongo.errors import PyMongoError

from .exceptions import TodoStorageError

logger = logging.getLogger(__name__)


def _utc_now():
    """Current UTC time truncated to milliseconds, the precision MongoDB stores.

    Truncating keeps the value returned by ``add`` identical to what ``list_all`` reads back.
    """
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


class TodoRepository:
    collection_name = 'todos'

    def __init__(self, database):
        self._collection = database[self.collection_name]

    def add(self, description):
        """Persist a new todo and return it as a dict (``id``, ``description``, ``created_at``)."""
        document = {'description': description, 'created_at': _utc_now()}
        try:
            self._collection.insert_one(document)  # adds the generated '_id' to `document`
        except PyMongoError as exc:
            logger.exception('Failed to insert todo')
            raise TodoStorageError('Could not save the todo') from exc
        return self._to_dict(document)

    def list_all(self):
        """Return every todo, oldest first."""
        try:
            documents = list(
                self._collection.find().sort([('created_at', ASCENDING), ('_id', ASCENDING)])
            )
        except PyMongoError as exc:
            logger.exception('Failed to list todos')
            raise TodoStorageError('Could not load the todos') from exc
        return [self._to_dict(document) for document in documents]

    @staticmethod
    def _to_dict(document):
        """Map a Mongo document to the public shape (ObjectId is not JSON serialisable)."""
        return {
            'id': str(document['_id']),
            'description': document['description'],
            'created_at': document['created_at'],
        }
