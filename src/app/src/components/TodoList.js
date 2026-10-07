import { TodoItem } from './TodoItem';

export function TodoList({ todos, isLoading, error, onRetry, onUpdate, onDelete }) {
  const hasTodos = todos.length > 0;
  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div>
      {error && (
        <p role="alert" className="error">
          {error}{' '}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      {isLoading && !hasTodos && <p>Loading…</p>}
      {!isLoading && !error && !hasTodos && <p>No todos yet. Add your first one below!</p>}
      {hasTodos && (
        <>
          <p className="summary">
            {completedCount} of {todos.length} completed
          </p>
          <ul className="todo-list">
            {todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
