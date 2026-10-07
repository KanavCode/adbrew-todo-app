from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from rest.exceptions import TodoNotFound, TodoStorageError
from rest.views import TodoDetailView, TodoListView


class InMemoryTodoRepository:
    """Test double with the same interface as TodoRepository, so no MongoDB is needed."""

    def __init__(self):
        self.todos = []

    def add(self, description):
        todo = {
            'id': str(len(self.todos) + 1),
            'description': description,
            'completed': False,
            'created_at': None,
        }
        self.todos.append(todo)
        return dict(todo)

    def list_all(self):
        return [dict(todo) for todo in self.todos]

    def update(self, todo_id, changes):
        todo = self._find(todo_id)
        todo.update(changes)
        return dict(todo)

    def delete(self, todo_id):
        self.todos.remove(self._find(todo_id))

    def _find(self, todo_id):
        for todo in self.todos:
            if todo['id'] == todo_id:
                return todo
        raise TodoNotFound(todo_id)


class BrokenTodoRepository:
    """Test double simulating an unreachable database."""

    def add(self, description):
        raise TodoStorageError('boom')

    def list_all(self):
        raise TodoStorageError('boom')

    def update(self, todo_id, changes):
        raise TodoStorageError('boom')

    def delete(self, todo_id):
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
        self.assertIs(response.data['completed'], False)
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


class TodoDetailViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.repository = InMemoryTodoRepository()
        self.repository.add('Learn Docker')
        self.view = TodoDetailView.as_view(repository=self.repository)

    def patch(self, todo_id, payload, view=None):
        request = self.factory.patch('/todos/{}/'.format(todo_id), payload, format='json')
        return (view or self.view)(request, todo_id=todo_id)

    def delete(self, todo_id, view=None):
        request = self.factory.delete('/todos/{}/'.format(todo_id))
        return (view or self.view)(request, todo_id=todo_id)

    def test_patch_marks_a_todo_as_completed(self):
        response = self.patch('1', {'completed': True})
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data['completed'], True)
        self.assertIs(self.repository.todos[0]['completed'], True)

    def test_patch_edits_the_description_and_trims_it(self):
        response = self.patch('1', {'description': '  Learn Kubernetes  '})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['description'], 'Learn Kubernetes')

    def test_patch_with_invalid_payload_returns_400_and_changes_nothing(self):
        for payload in ({}, {'description': '   '}, {'completed': 'yes'}, {'completed': 1}, ['x']):
            with self.subTest(payload=payload):
                self.assertEqual(self.patch('1', payload).status_code, 400)
        self.assertEqual(self.repository.todos[0]['description'], 'Learn Docker')
        self.assertIs(self.repository.todos[0]['completed'], False)

    def test_patch_unknown_todo_returns_404(self):
        response = self.patch('999', {'completed': True})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['detail'], 'Todo not found.')

    def test_delete_removes_the_todo(self):
        response = self.delete('1')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.repository.todos, [])

    def test_delete_unknown_todo_returns_404(self):
        self.assertEqual(self.delete('999').status_code, 404)
        self.assertEqual(len(self.repository.todos), 1)

    def test_get_on_a_single_todo_is_not_allowed(self):
        request = self.factory.get('/todos/1/')
        self.assertEqual(self.view(request, todo_id='1').status_code, 405)

    def test_storage_failure_returns_503_without_leaking_details(self):
        view = TodoDetailView.as_view(repository=BrokenTodoRepository())
        for response in (self.patch('1', {'completed': True}, view=view), self.delete('1', view=view)):
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('boom', str(response.data))
