"""rest URL Configuration

Routes are wired together here (composition root): this is where the concrete MongoDB-backed
repository is created and handed to the view.
"""
from django.urls import re_path

from .db import get_database
from .repositories import TodoRepository
from .views import TodoListView

urlpatterns = [
    # `/?` accepts both `/todos` and `/todos/`: with APPEND_SLASH, a POST to `/todos` cannot be
    # redirected and Django would raise an error instead.
    re_path(
        r'^todos/?$',
        TodoListView.as_view(repository=TodoRepository(get_database())),
        name='todo-list',
    ),
]
