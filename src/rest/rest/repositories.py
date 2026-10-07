"""Persistence layer for todos.

``TodoRepository`` is the only place that knows todos are stored in MongoDB. Views depend on its
methods (``add`` / ``list_all`` / ``update`` / ``delete``), so the storage engine can be swapped or
faked in tests without touching the HTTP layer.
"""
import logging
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import PyMongoError

from .exceptions import TodoNotFound, TodoStorageError

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
        """Persist a new todo and return it as a dict (``id``, ``description``, ``completed``, ``created_at``)."""
        document = {'description': description, 'completed': False, 'created_at': _utc_now()}
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

    def update(self, todo_id, changes):
        """Apply a partial update (``changes`` is a dict of fields) and return the updated todo.

        Raises ``TodoNotFound`` if there is no todo with that id.
        """
        object_id = self._to_object_id(todo_id)
        try:
            document = self._collection.find_one_and_update(
                {'_id': object_id},
                {'$set': changes},
                return_document=ReturnDocument.AFTER,
            )
        except PyMongoError as exc:
            logger.exception('Failed to update todo %s', todo_id)
            raise TodoStorageError('Could not update the todo') from exc
        if document is None:
            raise TodoNotFound(todo_id)
        return self._to_dict(document)

    def delete(self, todo_id):
        """Delete a todo. Raises ``TodoNotFound`` if there is no todo with that id."""
        object_id = self._to_object_id(todo_id)
        try:
            result = self._collection.delete_one({'_id': object_id})
        except PyMongoError as exc:
            logger.exception('Failed to delete todo %s', todo_id)
            raise TodoStorageError('Could not delete the todo') from exc
        if result.deleted_count == 0:
            raise TodoNotFound(todo_id)

    @staticmethod
    def _to_object_id(todo_id):
        """Parse a public id; a malformed id simply cannot match any todo."""
        if not ObjectId.is_valid(todo_id):
            raise TodoNotFound(todo_id)
        return ObjectId(todo_id)

    @staticmethod
    def _to_dict(document):
        """Map a Mongo document to the public shape (ObjectId is not JSON serialisable)."""
        return {
            'id': str(document['_id']),
            'description': document['description'],
            # Todos created before this field existed have no `completed` key.
            'completed': document.get('completed', False),
            'created_at': document['created_at'],
        }
