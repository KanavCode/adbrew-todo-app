import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoList } from './TodoList';

const renderList = (props) =>
  render(<TodoList todos={[]} isLoading={false} error={null} onRetry={jest.fn()} {...props} />);

describe('TodoList', () => {
  it('shows a loading message while the first load is in progress', () => {
    renderList({ isLoading: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no todos', () => {
    renderList();
    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument();
  });

  it('renders one list item per todo, in order', () => {
    renderList({
      todos: [
        { id: '1', description: 'Learn Docker' },
        { id: '2', description: 'Learn React' },
      ],
    });
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Learn Docker', 'Learn React']);
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
    renderList({ todos: [{ id: '1', description: 'Learn Docker' }], error: 'Reload failed.' });

    expect(screen.getByText('Learn Docker')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reload failed.');
  });

  it('does not show the loading message while todos are already displayed', () => {
    renderList({ todos: [{ id: '1', description: 'Learn Docker' }], isLoading: true });
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
