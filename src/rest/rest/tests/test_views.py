from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from rest.exceptions import TodoStorageError
from rest.views import TodoListView


class InMemoryTodoRepository:
    """Test double with the same interface as TodoRepository, so no MongoDB is needed."""

    def __init__(self):
        self.todos = []

    def add(self, description):
        todo = {'id': str(len(self.todos) + 1), 'description': description, 'created_at': None}
        self.todos.append(todo)
        return todo

    def list_all(self):
        return list(self.todos)


class BrokenTodoRepository:
    """Test double simulating an unreachable database."""

    def add(self, description):
        raise TodoStorageError('boom')

    def list_all(self):
        raise TodoStorageError('boom')


class TodoListViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.repository = InMemoryTodoRepository()
        self.view = TodoListView.as_view(repository=self.repository)

    def get(self):
        return self.view(self.factory.get('/todos/'))

    def post(self, payload):
        return self.view(self.factory.post('/todos/', payload, format='json'))

    def test_get_returns_empty_list_when_there_are_no_todos(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_post_creates_a_todo(self):
        response = self.post({'description': '  Learn Docker  '})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['description'], 'Learn Docker')
        self.assertEqual(len(self.repository.todos), 1)

    def test_get_returns_created_todos(self):
        self.post({'description': 'Learn Docker'})
        self.post({'description': 'Learn React'})
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual([t['description'] for t in response.data], ['Learn Docker', 'Learn React'])

    def test_post_with_invalid_payload_returns_400_and_stores_nothing(self):
        for payload in ({}, {'description': ''}, {'description': 5}, ['x']):
            with self.subTest(payload=payload):
                response = self.post(payload)
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.repository.todos, [])

    def test_post_with_malformed_json_returns_400(self):
        request = self.factory.post('/todos/', '{nope', content_type='application/json')
        self.assertEqual(self.view(request).status_code, 400)

    def test_post_with_unsupported_content_type_returns_415(self):
        request = self.factory.post('/todos/', 'description=x', content_type='text/plain')
        self.assertEqual(self.view(request).status_code, 415)

    def test_unsupported_method_returns_405(self):
        self.assertEqual(self.view(self.factory.delete('/todos/')).status_code, 405)

    def test_storage_failure_returns_503_without_leaking_details(self):
        view = TodoListView.as_view(repository=BrokenTodoRepository())
        for response in (
            view(self.factory.get('/todos/')),
            view(self.factory.post('/todos/', {'description': 'x'}, format='json')),
        ):
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('boom', str(response.data))
