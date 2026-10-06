from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import ServiceUnavailable, TodoStorageError
from .validators import validate_description


class TodoListView(APIView):
    """List todos (GET) and create a new one (POST).

    The view only deals with HTTP: it validates input, delegates to the repository, and shapes
    the response. The repository is injected via ``as_view(repository=...)`` (see urls.py).
    """
    repository = None

    def get(self, request):
        return Response(self.repository.list_all(), status=status.HTTP_200_OK)

    def post(self, request):
        description = validate_description(request.data)
        todo = self.repository.add(description)
        return Response(todo, status=status.HTTP_201_CREATED)

    def handle_exception(self, exc):
        # One place to turn a storage failure into a clean 503, instead of a try/except per method.
        if isinstance(exc, TodoStorageError):
            exc = ServiceUnavailable()
        return super().handle_exception(exc)
