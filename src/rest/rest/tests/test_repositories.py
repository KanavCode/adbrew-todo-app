"""Integration tests: these talk to the real MongoDB container (run them via docker, see README).

Each test uses its own throw-away database, dropped afterwards, so the app's data is untouched.
"""
import uuid

from django.test import SimpleTestCase
from pymongo import MongoClient

from rest.db import get_client
from rest.exceptions import TodoStorageError
from rest.repositories import TodoRepository


class TodoRepositoryTests(SimpleTestCase):
    def setUp(self):
        self.database_name = 'test_todos_{}'.format(uuid.uuid4().hex)
        self.repository = TodoRepository(get_client()[self.database_name])
        self.addCleanup(get_client().drop_database, self.database_name)

    def test_add_returns_the_public_shape(self):
        todo = self.repository.add('Learn Docker')
        self.assertEqual(set(todo), {'id', 'description', 'created_at'})
        self.assertIsInstance(todo['id'], str)  # ObjectId must not leak out
        self.assertEqual(todo['description'], 'Learn Docker')
        self.assertIsNotNone(todo['created_at'].tzinfo)  # timezone-aware (UTC)

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
