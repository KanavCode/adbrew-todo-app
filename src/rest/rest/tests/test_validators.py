from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from rest.validators import MAX_DESCRIPTION_LENGTH, validate_description


class ValidateDescriptionTests(SimpleTestCase):
    def test_returns_the_description(self):
        self.assertEqual(validate_description({'description': 'Learn Docker'}), 'Learn Docker')

    def test_strips_surrounding_whitespace(self):
        self.assertEqual(validate_description({'description': '  Learn Docker \n'}), 'Learn Docker')

    def test_accepts_the_maximum_length(self):
        description = 'x' * MAX_DESCRIPTION_LENGTH
        self.assertEqual(validate_description({'description': description}), description)

    def assertInvalid(self, payload, field):
        with self.assertRaises(ValidationError) as ctx:
            validate_description(payload)
        self.assertIn(field, ctx.exception.detail)

    def test_rejects_missing_description(self):
        self.assertInvalid({}, 'description')

    def test_rejects_non_string_description(self):
        for value in (None, 123, ['a'], {'a': 1}, True):
            with self.subTest(value=value):
                self.assertInvalid({'description': value}, 'description')

    def test_rejects_blank_description(self):
        for value in ('', '   ', '\n\t'):
            with self.subTest(value=repr(value)):
                self.assertInvalid({'description': value}, 'description')

    def test_rejects_too_long_description(self):
        self.assertInvalid({'description': 'x' * (MAX_DESCRIPTION_LENGTH + 1)}, 'description')

    def test_length_limit_applies_after_stripping(self):
        padded = ' ' + 'x' * MAX_DESCRIPTION_LENGTH + ' '
        self.assertEqual(validate_description({'description': padded}), 'x' * MAX_DESCRIPTION_LENGTH)

    def test_rejects_non_object_payload(self):
        for payload in (None, [], ['description'], 'description', 5):
            with self.subTest(payload=payload):
                self.assertInvalid(payload, 'non_field_errors')
