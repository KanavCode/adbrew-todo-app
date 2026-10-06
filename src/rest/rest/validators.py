"""Request payload validation (plain Python, no Django serializers or models)."""
from collections.abc import Mapping

from rest_framework.exceptions import ValidationError

MAX_DESCRIPTION_LENGTH = 200


def validate_description(payload):
    """Return the cleaned todo description from a request body.

    Raises ``ValidationError`` (rendered by DRF as HTTP 400 with a field-keyed message) when the
    body is not a JSON object or the description is missing, not a string, blank, or too long.
    """
    if not isinstance(payload, Mapping):
        raise ValidationError({'non_field_errors': ['Expected a JSON object.']})

    if 'description' not in payload:
        raise ValidationError({'description': ['This field is required.']})

    description = payload['description']
    if not isinstance(description, str):
        raise ValidationError({'description': ['Not a valid string.']})

    description = description.strip()
    if not description:
        raise ValidationError({'description': ['This field may not be blank.']})
    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise ValidationError({
            'description': ['Ensure this field has no more than {} characters.'.format(MAX_DESCRIPTION_LENGTH)]
        })
    return description
