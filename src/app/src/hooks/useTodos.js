import { useCallback, useEffect, useRef, useState } from 'react';
import { createTodo, listTodos } from '../api/todoApi';

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

  return { todos, isLoading, error, addTodo, refresh };
}
