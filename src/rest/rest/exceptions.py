from rest_framework import status
from rest_framework.exceptions import APIException


class TodoStorageError(Exception):
    """The todo store failed to complete an operation (e.g. MongoDB is unreachable).

    Raised by the repository layer, which knows nothing about HTTP.
    """


class TodoNotFound(Exception):
    """No todo exists with the requested id (including ids that are not valid ObjectIds)."""


class ServiceUnavailable(APIException):
    """HTTP 503, the API-level translation of a storage failure."""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'The todo store is temporarily unavailable. Please try again later.'
    default_code = 'service_unavailable'
