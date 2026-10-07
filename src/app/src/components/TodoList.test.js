import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoList } from './TodoList';

const renderList = (props) =>
  render(
    <TodoList
      todos={[]}
      isLoading={false}
      error={null}
      onRetry={jest.fn()}
      onUpdate={jest.fn().mockResolvedValue()}
      onDelete={jest.fn().mockResolvedValue()}
      {...props}
    />
  );

const todo = (id, description, completed = false) => ({ id, description, completed });

describe('TodoList', () => {
  it('shows a loading message while the first load is in progress', () => {
    renderList({ isLoading: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no todos', () => {
    renderList();
    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
  });

  it('renders one row per todo, in order', () => {
    renderList({ todos: [todo('1', 'Learn Docker'), todo('2', 'Learn React')] });

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Learn Docker')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Learn React')).toBeInTheDocument();
  });

  it('summarises how many todos are completed', () => {
    renderList({
      todos: [todo('1', 'a', true), todo('2', 'b'), todo('3', 'c', true)],
    });
    expect(screen.getByText('2 of 3 completed')).toBeInTheDocument();
  });

  it('passes the update and delete handlers to the rows', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    const onDelete = jest.fn().mockResolvedValue();
    renderList({ todos: [todo('7', 'Learn Docker')], onUpdate, onDelete });

    userEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith('7', { completed: true });
    // A row is busy (its controls are disabled) until its change has settled.
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());

    userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith('7');
    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeEnabled());
  });

  it('shows the error with a retry button, and no empty-state message', () => {
    const onRetry = jest.fn();
    renderList({ error: 'Unable to reach the server.', onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the server.');
    expect(screen.queryByText(/no todos yet/i)).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps showing existing todos next to a reload error', () => {
    renderList({ todos: [todo('1', 'Learn Docker')], error: 'Reload failed.' });

    expect(screen.getByText('Learn Docker')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reload failed.');
  });

  it('does not show the loading message while todos are already displayed', () => {
    renderList({ todos: [todo('1', 'Learn Docker')], isLoading: true });
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
