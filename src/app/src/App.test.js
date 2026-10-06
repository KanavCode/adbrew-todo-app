import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createTodo, listTodos } from './api/todoApi';

// Integration tests: the real App, hook and components, with only the network layer replaced.
jest.mock('./api/todoApi');

const todo = (id, description) => ({ id, description, created_at: '2026-10-06T10:00:00Z' });

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
});
