import './App.css';
import { TodoForm } from './components/TodoForm';
import { TodoList } from './components/TodoList';
import { useTodos } from './hooks/useTodos';

export function App() {
  const { todos, isLoading, error, addTodo, refresh } = useTodos();

  return (
    <div className="App">
      <section>
        <h1>List of TODOs</h1>
        <TodoList todos={todos} isLoading={isLoading} error={error} onRetry={refresh} />
      </section>
      <section>
        <h1>Create a ToDo</h1>
        <TodoForm onAdd={addTodo} />
      </section>
    </div>
  );
}

export default App;
