"""Integration tests: these talk to the real MongoDB container (run them via docker, see README).

Each test uses its own throw-away database, dropped afterwards, so the app's data is untouched.
"""
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from django.test import SimpleTestCase
from pymongo import MongoClient

from rest.db import get_client
from rest.exceptions import TodoNotFound, TodoStorageError
from rest.repositories import TodoRepository


class TodoRepositoryTests(SimpleTestCase):
    def setUp(self):
        self.database_name = 'test_todos_{}'.format(uuid.uuid4().hex)
        self.database = get_client()[self.database_name]
        self.repository = TodoRepository(self.database)
        self.addCleanup(get_client().drop_database, self.database_name)

    def test_add_returns_the_public_shape(self):
        todo = self.repository.add('Learn Docker')
        self.assertEqual(set(todo), {'id', 'description', 'completed', 'created_at'})
        self.assertIsInstance(todo['id'], str)  # ObjectId must not leak out
        self.assertEqual(todo['description'], 'Learn Docker')
        self.assertIs(todo['completed'], False)
        self.assertIsNotNone(todo['created_at'].tzinfo)  # timezone-aware (UTC)

    def test_todos_stored_before_completed_existed_read_as_not_completed(self):
        self.database['todos'].insert_one({'description': 'legacy', 'created_at': datetime.now(timezone.utc)})
        self.assertIs(self.repository.list_all()[0]['completed'], False)

    def test_update_changes_only_the_given_fields_and_returns_the_todo(self):
        todo = self.repository.add('Learn Docker')

        completed = self.repository.update(todo['id'], {'completed': True})
        self.assertIs(completed['completed'], True)
        self.assertEqual(completed['description'], 'Learn Docker')

        renamed = self.repository.update(todo['id'], {'description': 'Learn Compose'})
        self.assertEqual(renamed['description'], 'Learn Compose')
        self.assertIs(renamed['completed'], True)
        self.assertEqual(renamed['created_at'], todo['created_at'])
        self.assertEqual(self.repository.list_all(), [renamed])  # really persisted

    def test_update_only_touches_the_requested_todo(self):
        first = self.repository.add('first')
        second = self.repository.add('second')
        self.repository.update(first['id'], {'completed': True})
        self.assertEqual(self.repository.list_all()[1], second)

    def test_delete_removes_only_that_todo(self):
        first = self.repository.add('first')
        second = self.repository.add('second')
        self.repository.delete(first['id'])
        self.assertEqual(self.repository.list_all(), [second])

    def test_unknown_or_malformed_ids_raise_todo_not_found(self):
        for todo_id in (str(ObjectId()), 'not-an-object-id', '', '123'):
            with self.subTest(todo_id=todo_id):
                with self.assertRaises(TodoNotFound):
                    self.repository.update(todo_id, {'completed': True})
                with self.assertRaises(TodoNotFound):
                    self.repository.delete(todo_id)

    def test_deleting_twice_raises_todo_not_found(self):
        todo = self.repository.add('once')
        self.repository.delete(todo['id'])
        with self.assertRaises(TodoNotFound):
            self.repository.delete(todo['id'])

    def test_list_all_is_empty_initially(self):
        self.assertEqual(self.repository.list_all(), [])

    def test_list_all_returns_what_add_returned_oldest_first(self):
        first = self.repository.add('first')
        second = self.repository.add('second')
        self.assertEqual(self.repository.list_all(), [first, second])

    def test_storage_failure_is_wrapped_in_todo_storage_error(self):
        unreachable = MongoClient('mongodb://localhost:1', serverSelectionTimeoutMS=100)
        self.addCleanup(unreachable.close)
        repository = TodoRepository(unreachable['db'])
        # assertLogs also keeps the expected error tracebacks out of the test output
        with self.assertLogs('rest.repositories', level='ERROR'):
            with self.assertRaises(TodoStorageError):
                repository.list_all()
            with self.assertRaises(TodoStorageError):
                repository.add('x')
            with self.assertRaises(TodoStorageError):
                repository.update(str(ObjectId()), {'completed': True})
            with self.assertRaises(TodoStorageError):
                repository.delete(str(ObjectId()))
