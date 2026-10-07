from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from rest.validators import MAX_DESCRIPTION_LENGTH, validate_description, validate_todo_update


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


class ValidateTodoUpdateTests(SimpleTestCase):
    def assertInvalid(self, payload, field):
        with self.assertRaises(ValidationError) as ctx:
            validate_todo_update(payload)
        self.assertIn(field, ctx.exception.detail)

    def test_accepts_a_description_only(self):
        self.assertEqual(validate_todo_update({'description': '  New  '}), {'description': 'New'})

    def test_accepts_completed_only(self):
        self.assertEqual(validate_todo_update({'completed': True}), {'completed': True})
        self.assertEqual(validate_todo_update({'completed': False}), {'completed': False})

    def test_accepts_both_fields_and_ignores_unknown_keys(self):
        payload = {'description': 'New', 'completed': True, 'id': 'hacked', 'created_at': 'x'}
        self.assertEqual(validate_todo_update(payload), {'description': 'New', 'completed': True})

    def test_requires_at_least_one_field(self):
        self.assertInvalid({}, 'non_field_errors')
        self.assertInvalid({'unknown': 1}, 'non_field_errors')

    def test_applies_the_description_rules(self):
        for value in ('', '   ', 5, None, 'x' * (MAX_DESCRIPTION_LENGTH + 1)):
            with self.subTest(value=value):
                self.assertInvalid({'description': value}, 'description')

    def test_completed_must_be_a_real_boolean(self):
        for value in ('true', 1, 0, None, []):
            with self.subTest(value=value):
                self.assertInvalid({'completed': value}, 'completed')

    def test_rejects_non_object_payload(self):
        for payload in (None, [], 'x', 5):
            with self.subTest(payload=payload):
                self.assertInvalid(payload, 'non_field_errors')
