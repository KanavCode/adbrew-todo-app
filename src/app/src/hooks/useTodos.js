import { useCallback, useEffect, useRef, useState } from 'react';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../api/todoApi';

export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);
  const latestRequestId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    const isCurrent = () => isMounted.current && requestId === latestRequestId.current;

    setIsLoading(true);
    try {
      const latestTodos = await listTodos();
      if (isCurrent()) {
        setTodos(latestTodos);
        setError(null);
      }
    } catch (err) {
      if (isCurrent()) {
        setError(err.message);
      }
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    refresh();
    return () => {
      isMounted.current = false;
    };
  }, [refresh]);

  const addTodo = useCallback(
    async (description) => {
      await createTodo(description);
      await refresh();
    },
    [refresh]
  );

  // Like addTodo: these reject when the change fails (so the caller can show the error next to
  // the item), and reload the list from the backend when it succeeds.
  const changeTodo = useCallback(
    async (id, changes) => {
      await updateTodo(id, changes);
      await refresh();
    },
    [refresh]
  );

  const removeTodo = useCallback(
    async (id) => {
      await deleteTodo(id);
      await refresh();
    },
    [refresh]
  );

  return { todos, isLoading, error, addTodo, changeTodo, removeTodo, refresh };
}
