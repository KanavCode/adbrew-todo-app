import { useEffect, useRef, useState } from 'react';
import { MAX_DESCRIPTION_LENGTH } from '../config';

/**
 * One row of the list: toggle completed, edit the description inline, or delete.
 *
 * `onUpdate(id, changes)` and `onDelete(id)` must return promises that reject with an Error
 * (whose message is shown next to the row) when the change could not be saved.
 */
export function TodoItem({ todo, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.description);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isEditing) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Runs a change while tracking the busy/error state; resolves to whether it succeeded.
  async function run(action) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      if (isMounted.current) {
        setError(err.message);
      }
      return false;
    } finally {
      // After a successful delete the row is gone from the list, so it may already be unmounted.
      if (isMounted.current) {
        setIsBusy(false);
      }
    }
  }

  const handleToggle = () => run(() => onUpdate(todo.id, { completed: !todo.completed }));
  const handleDelete = () => run(() => onDelete(todo.id));

  function startEditing() {
    setDraft(todo.description);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setError(null);
    setIsEditing(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    const description = draft.trim();
    if (!description || isBusy) {
      return;
    }
    if (description === todo.description) {
      setIsEditing(false); // nothing changed, so no request is needed
      return;
    }
    const saved = await run(() => onUpdate(todo.id, { description }));
    if (saved && isMounted.current) {
      setIsEditing(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  return (
    <li className="todo-item">
      {isEditing ? (
        <form className="todo-row" onSubmit={handleSave}>
          <input
            ref={inputRef}
            type="text"
            aria-label="Edit todo"
            value={draft}
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="todo-actions">
            <button type="submit" className="primary" disabled={isBusy || !draft.trim()}>
              Save
            </button>
            <button type="button" onClick={cancelEditing} disabled={isBusy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="todo-row">
          <label className="todo-label">
            <input
              type="checkbox"
              checked={Boolean(todo.completed)}
              onChange={handleToggle}
              disabled={isBusy}
            />
            <span className={todo.completed ? 'todo-text completed' : 'todo-text'}>
              {todo.description}
            </span>
          </label>
          <div className="todo-actions">
            <button
              type="button"
              onClick={startEditing}
              disabled={isBusy}
              aria-label={`Edit "${todo.description}"`}
            >
              Edit
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleDelete}
              disabled={isBusy}
              aria-label={`Delete "${todo.description}"`}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </li>
  );
}
