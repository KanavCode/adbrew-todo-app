"""Request payload validation (plain Python, no Django serializers or models)."""
from collections.abc import Mapping

from rest_framework.exceptions import ValidationError

MAX_DESCRIPTION_LENGTH = 200


def _require_object(payload):
    if not isinstance(payload, Mapping):
        raise ValidationError({'non_field_errors': ['Expected a JSON object.']})


def _clean_description(value):
    """Return the stripped description, or raise a ValidationError keyed by the field name."""
    if not isinstance(value, str):
        raise ValidationError({'description': ['Not a valid string.']})

    description = value.strip()
    if not description:
        raise ValidationError({'description': ['This field may not be blank.']})
    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise ValidationError({
            'description': ['Ensure this field has no more than {} characters.'.format(MAX_DESCRIPTION_LENGTH)]
        })
    return description


def validate_description(payload):
    """Return the cleaned todo description from a request body.

    Raises ``ValidationError`` (rendered by DRF as HTTP 400 with a field-keyed message) when the
    body is not a JSON object or the description is missing, not a string, blank, or too long.
    """
    _require_object(payload)
    if 'description' not in payload:
        raise ValidationError({'description': ['This field is required.']})
    return _clean_description(payload['description'])


def validate_todo_update(payload):
    """Return the validated changes of a partial update as a dict.

    Only ``description`` and ``completed`` can be changed; other keys are ignored. At least one
    of them must be present.
    """
    _require_object(payload)
    changes = {}

    if 'description' in payload:
        changes['description'] = _clean_description(payload['description'])

    if 'completed' in payload:
        if not isinstance(payload['completed'], bool):
            raise ValidationError({'completed': ['Must be a boolean.']})
        changes['completed'] = payload['completed']

    if not changes:
        raise ValidationError({'non_field_errors': ['Provide at least one of: description, completed.']})
    return changes
