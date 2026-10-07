import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createTodo, deleteTodo, listTodos, updateTodo } from './api/todoApi';

// Integration tests: the real App, hook and components, with only the network layer replaced.
jest.mock('./api/todoApi');

const todo = (id, description, completed = false) => ({
  id,
  description,
  completed,
  created_at: '2026-10-06T10:00:00Z',
});

describe('App', () => {
  it('loads and shows the todos from the backend', async () => {
    listTodos.mockResolvedValue([todo('1', 'Learn Docker'), todo('2', 'Learn React')]);
    render(<App />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByText('Learn Docker')).toBeInTheDocument();
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(listTodos).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when the backend has no todos', async () => {
    listTodos.mockResolvedValue([]);
    render(<App />);

    expect(await screen.findByText(/no todos yet/i)).toBeInTheDocument();
  });

  it('shows an error when loading fails and recovers on retry', async () => {
    listTodos
      .mockRejectedValueOnce(new Error('Unable to reach the server.'))
      .mockResolvedValueOnce([todo('1', 'Learn Docker')]);
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.');

    userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Learn Docker')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('creates a todo, then refreshes the list from the backend', async () => {
    listTodos
      .mockResolvedValueOnce([todo('1', 'Learn Docker')])
      .mockResolvedValueOnce([todo('1', 'Learn Docker'), todo('2', 'Learn React')]);
    createTodo.mockResolvedValue(todo('2', 'Learn React'));
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.type(screen.getByLabelText(/todo:/i), '  Learn React  ');
    userEvent.click(screen.getByRole('button', { name: /add todo/i }));

    expect(await screen.findByText('Learn React')).toBeInTheDocument();
    expect(createTodo).toHaveBeenCalledWith('Learn React');
    expect(listTodos).toHaveBeenCalledTimes(2); // initial load + refresh after the submit
    await waitFor(() => expect(screen.getByLabelText(/todo:/i)).toHaveValue(''));
  });

  it('shows the error and does not reload when creating a todo fails', async () => {
    listTodos.mockResolvedValue([todo('1', 'Learn Docker')]);
    createTodo.mockRejectedValue(new Error('Description may not be blank.'));
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.type(screen.getByLabelText(/todo:/i), 'x');
    userEvent.click(screen.getByRole('button', { name: /add todo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Description may not be blank.');
    expect(listTodos).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/todo:/i)).toHaveValue('x');
  });

  it('marks a todo as completed, then refreshes the list from the backend', async () => {
    listTodos
      .mockResolvedValueOnce([todo('1', 'Learn Docker')])
      .mockResolvedValueOnce([todo('1', 'Learn Docker', true)]);
    updateTodo.mockResolvedValue(todo('1', 'Learn Docker', true));
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.click(screen.getByRole('checkbox', { name: 'Learn Docker' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Learn Docker' })).toBeChecked());
    expect(updateTodo).toHaveBeenCalledWith('1', { completed: true });
    expect(listTodos).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 of 1 completed')).toBeInTheDocument();
  });

  it('edits a todo and shows the saved text', async () => {
    listTodos
      .mockResolvedValueOnce([todo('1', 'Learn Docker')])
      .mockResolvedValueOnce([todo('1', 'Learn Compose')]);
    updateTodo.mockResolvedValue(todo('1', 'Learn Compose'));
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.click(screen.getByRole('button', { name: /edit "learn docker"/i }));
    userEvent.clear(screen.getByLabelText('Edit todo'));
    userEvent.type(screen.getByLabelText('Edit todo'), 'Learn Compose{enter}');

    expect(await screen.findByText('Learn Compose')).toBeInTheDocument();
    expect(updateTodo).toHaveBeenCalledWith('1', { description: 'Learn Compose' });
    expect(screen.queryByLabelText('Edit todo')).not.toBeInTheDocument();
    expect(screen.queryByText('Learn Docker')).not.toBeInTheDocument();
  });

  it('deletes a todo and refreshes the list from the backend', async () => {
    listTodos
      .mockResolvedValueOnce([todo('1', 'Learn Docker'), todo('2', 'Learn React')])
      .mockResolvedValueOnce([todo('2', 'Learn React')]);
    deleteTodo.mockResolvedValue(null);
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.click(screen.getByRole('button', { name: /delete "learn docker"/i }));

    await waitFor(() => expect(screen.queryByText('Learn Docker')).not.toBeInTheDocument());
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(deleteTodo).toHaveBeenCalledWith('1');
    expect(listTodos).toHaveBeenCalledTimes(2);
  });

  it('shows an error on the todo whose change failed and keeps the others untouched', async () => {
    listTodos.mockResolvedValue([todo('1', 'Learn Docker'), todo('2', 'Learn React')]);
    deleteTodo.mockRejectedValue(new Error('The todo store is unavailable.'));
    render(<App />);
    await screen.findByText('Learn Docker');

    userEvent.click(screen.getByRole('button', { name: /delete "learn docker"/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The todo store is unavailable.');
    expect(screen.getByText('Learn Docker')).toBeInTheDocument();
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(listTodos).toHaveBeenCalledTimes(1); // no reload after a failed change
  });
});
