from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import ServiceUnavailable, TodoNotFound, TodoStorageError
from .validators import validate_description, validate_todo_update


class TodoAPIView(APIView):
    """Base for the todo views: holds the injected repository and translates its errors.

    The views only deal with HTTP: they validate input, delegate to the repository, and shape
    the response. The repository is injected via ``as_view(repository=...)`` (see urls.py).
    """
    repository = None

    def handle_exception(self, exc):
        # One place to turn repository failures into clean HTTP errors, instead of a try/except
        # in every method.
        if isinstance(exc, TodoStorageError):
            exc = ServiceUnavailable()
        elif isinstance(exc, TodoNotFound):
            exc = NotFound('Todo not found.')
        return super().handle_exception(exc)


class TodoListView(TodoAPIView):
    """List todos (GET) and create a new one (POST)."""

    def get(self, request):
        return Response(self.repository.list_all(), status=status.HTTP_200_OK)

    def post(self, request):
        description = validate_description(request.data)
        todo = self.repository.add(description)
        return Response(todo, status=status.HTTP_201_CREATED)


class TodoDetailView(TodoAPIView):
    """Update (PATCH) or delete (DELETE) a single todo."""

    def patch(self, request, todo_id):
        changes = validate_todo_update(request.data)
        todo = self.repository.update(todo_id, changes)
        return Response(todo, status=status.HTTP_200_OK)

    def delete(self, request, todo_id):
        self.repository.delete(todo_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
