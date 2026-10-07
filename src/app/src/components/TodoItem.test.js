import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_DESCRIPTION_LENGTH } from '../config';
import { TodoItem } from './TodoItem';

const todo = { id: '1', description: 'Learn Docker', completed: false };

const renderItem = ({ todo: item = todo, onUpdate, onDelete } = {}) =>
  render(
    <ul>
      <TodoItem
        todo={item}
        onUpdate={onUpdate || jest.fn().mockResolvedValue()}
        onDelete={onDelete || jest.fn().mockResolvedValue()}
      />
    </ul>
  );

const getEditButton = () => screen.getByRole('button', { name: /edit "learn docker"/i });
const getDeleteButton = () => screen.getByRole('button', { name: /delete "learn docker"/i });
const getEditInput = () => screen.getByLabelText('Edit todo');

describe('TodoItem: display', () => {
  it('shows an open todo as unchecked', () => {
    renderItem();
    expect(screen.getByRole('checkbox', { name: 'Learn Docker' })).not.toBeChecked();
    expect(screen.getByText('Learn Docker')).not.toHaveClass('completed');
  });

  it('shows a completed todo as checked and struck through', () => {
    renderItem({ todo: { ...todo, completed: true } });
    expect(screen.getByRole('checkbox', { name: 'Learn Docker' })).toBeChecked();
    expect(screen.getByText('Learn Docker')).toHaveClass('completed');
  });

  it('treats a todo without a completed flag as not completed', () => {
    renderItem({ todo: { id: '1', description: 'Learn Docker' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

describe('TodoItem: toggle and delete', () => {
  it('marks the todo as completed when the checkbox is clicked', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    renderItem({ onUpdate });

    userEvent.click(screen.getByRole('checkbox'));

    expect(onUpdate).toHaveBeenCalledWith('1', { completed: true });
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
  });

  it('marks a completed todo as open again', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    renderItem({ todo: { ...todo, completed: true }, onUpdate });

    userEvent.click(screen.getByRole('checkbox'));

    expect(onUpdate).toHaveBeenCalledWith('1', { completed: false });
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
  });

  it('deletes the todo', async () => {
    const onDelete = jest.fn().mockResolvedValue();
    renderItem({ onDelete });

    userEvent.click(getDeleteButton());

    expect(onDelete).toHaveBeenCalledWith('1');
    await waitFor(() => expect(getDeleteButton()).toBeEnabled());
  });

  it('disables the controls while a change is in flight', async () => {
    let resolveUpdate;
    const onUpdate = jest.fn(() => new Promise((resolve) => (resolveUpdate = resolve)));
    renderItem({ onUpdate });

    userEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(getEditButton()).toBeDisabled();
    expect(getDeleteButton()).toBeDisabled();

    resolveUpdate();
    await waitFor(() => expect(getDeleteButton()).toBeEnabled());
  });

  it('shows the error and re-enables the controls when a change fails', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('Todo not found.'));
    renderItem({ onDelete });

    userEvent.click(getDeleteButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Todo not found.');
    expect(getDeleteButton()).toBeEnabled();
  });

  it('does not update its state after being removed from the page', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    // A parent that removes the row once the delete succeeds, like the real list does.
    function Parent() {
      const [visible, setVisible] = useState(true);
      return visible ? (
        <ul>
          <TodoItem todo={todo} onUpdate={jest.fn()} onDelete={async () => setVisible(false)} />
        </ul>
      ) : (
        <p>gone</p>
      );
    }
    render(<Parent />);

    userEvent.click(getDeleteButton());

    expect(await screen.findByText('gone')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('TodoItem: editing', () => {
  it('opens an input with the current text, focused', () => {
    renderItem();

    userEvent.click(getEditButton());

    expect(getEditInput()).toHaveValue('Learn Docker');
    expect(getEditInput()).toHaveFocus();
    expect(getEditInput()).toHaveAttribute('maxLength', String(MAX_DESCRIPTION_LENGTH));
  });

  it('saves the trimmed new text and closes the editor', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.clear(getEditInput());
    userEvent.type(getEditInput(), '  Learn Compose  ');
    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith('1', { description: 'Learn Compose' });
    await waitFor(() => expect(screen.queryByLabelText('Edit todo')).not.toBeInTheDocument());
  });

  it('can be saved with the Enter key', async () => {
    const onUpdate = jest.fn().mockResolvedValue();
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.type(getEditInput(), '!{enter}');

    expect(onUpdate).toHaveBeenCalledWith('1', { description: 'Learn Docker!' });
    await waitFor(() => expect(screen.queryByLabelText('Edit todo')).not.toBeInTheDocument());
  });

  it('does not allow saving a blank description', () => {
    const onUpdate = jest.fn();
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.clear(getEditInput());

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    userEvent.type(getEditInput(), '   {enter}');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('closes the editor without a request when nothing changed', () => {
    const onUpdate = jest.fn();
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit todo')).not.toBeInTheDocument();
  });

  it('discards the changes on Cancel and on Escape', () => {
    const onUpdate = jest.fn();
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.type(getEditInput(), ' changed');
    userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Learn Docker')).toBeInTheDocument();

    userEvent.click(getEditButton());
    expect(getEditInput()).toHaveValue('Learn Docker'); // the discarded draft is gone
    userEvent.type(getEditInput(), '{esc}');
    expect(screen.queryByLabelText('Edit todo')).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps the editor open with the typed text when saving fails', async () => {
    const onUpdate = jest.fn().mockRejectedValue(new Error('The todo store is unavailable.'));
    renderItem({ onUpdate });

    userEvent.click(getEditButton());
    userEvent.type(getEditInput(), '!');
    userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The todo store is unavailable.');
    expect(getEditInput()).toHaveValue('Learn Docker!');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
