import { useState } from 'react';
import { MAX_DESCRIPTION_LENGTH } from '../config';

export function TodoForm({ onAdd }) {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmedDescription = description.trim();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!trimmedDescription || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd(trimmedDescription);
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="todo-description">ToDo: </label>
        <input
          id="todo-description"
          type="text"
          value={description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="form-actions">
        <button type="submit" disabled={!trimmedDescription || isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add ToDo!'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
