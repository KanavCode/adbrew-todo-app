export function TodoList({ todos, isLoading, error, onRetry }) {
  const hasTodos = todos.length > 0;

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
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
