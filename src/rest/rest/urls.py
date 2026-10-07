"""rest URL Configuration

Routes are wired together here (composition root): this is where the concrete MongoDB-backed
repository is created and handed to the views.
"""
from django.urls import re_path

from .db import get_database
from .repositories import TodoRepository
from .views import TodoDetailView, TodoListView

repository = TodoRepository(get_database())

urlpatterns = [
    # `/?` accepts both `/todos` and `/todos/`: with APPEND_SLASH, a POST to `/todos` cannot be
    # redirected and Django would raise an error instead.
    re_path(r'^todos/?$', TodoListView.as_view(repository=repository), name='todo-list'),
    # The id is validated by the repository, so a malformed id yields a JSON 404 from the API
    # instead of Django's HTML "page not found".
    re_path(r'^todos/(?P<todo_id>[^/]+)/?$', TodoDetailView.as_view(repository=repository), name='todo-detail'),
]
