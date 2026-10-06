import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_DESCRIPTION_LENGTH } from '../config';
import { TodoForm } from './TodoForm';

const getInput = () => screen.getByLabelText(/todo:/i);
const getButton = () => screen.getByRole('button', { name: /add todo/i });

describe('TodoForm', () => {
  it('disables the button while the description is blank', () => {
    render(<TodoForm onAdd={jest.fn()} />);
    expect(getButton()).toBeDisabled();

    userEvent.type(getInput(), '   ');
    expect(getButton()).toBeDisabled();

    userEvent.type(getInput(), 'Learn Docker');
    expect(getButton()).toBeEnabled();
  });

  it('limits the input to the maximum description length', () => {
    render(<TodoForm onAdd={jest.fn()} />);
    expect(getInput()).toHaveAttribute('maxLength', String(MAX_DESCRIPTION_LENGTH));
  });

  it('submits the trimmed description and clears the input on success', async () => {
    const onAdd = jest.fn().mockResolvedValue();
    render(<TodoForm onAdd={onAdd} />);

    userEvent.type(getInput(), '  Learn Docker  ');
    userEvent.click(getButton());

    expect(onAdd).toHaveBeenCalledWith('Learn Docker');
    await waitFor(() => expect(getInput()).toHaveValue(''));
  });

  it('can be submitted with the Enter key', async () => {
    const onAdd = jest.fn().mockResolvedValue();
    render(<TodoForm onAdd={onAdd} />);

    userEvent.type(getInput(), 'Learn React{enter}');

    expect(onAdd).toHaveBeenCalledWith('Learn React');
    await waitFor(() => expect(getInput()).toHaveValue(''));
  });

  it('prevents double submission while a request is in flight', async () => {
    let resolveAdd;
    const onAdd = jest.fn(() => new Promise((resolve) => (resolveAdd = resolve)));
    render(<TodoForm onAdd={onAdd} />);

    userEvent.type(getInput(), 'Learn Docker');
    userEvent.click(getButton());

    const pendingButton = screen.getByRole('button', { name: /adding/i });
    expect(pendingButton).toBeDisabled();
    userEvent.type(getInput(), '{enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);

    resolveAdd();
    await waitFor(() => expect(getButton()).toBeDisabled()); // back to "Add ToDo!", input cleared
    expect(getInput()).toHaveValue('');
  });

  it('shows the error and keeps the typed text when adding fails', async () => {
    const onAdd = jest.fn().mockRejectedValue(new Error('The todo store is unavailable.'));
    render(<TodoForm onAdd={onAdd} />);

    userEvent.type(getInput(), 'Learn Docker');
    userEvent.click(getButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('The todo store is unavailable.');
    expect(getInput()).toHaveValue('Learn Docker');
    expect(getButton()).toBeEnabled(); // the user can retry
  });

  it('clears the previous error when submitting again', async () => {
    const onAdd = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure.'))
      .mockResolvedValueOnce();
    render(<TodoForm onAdd={onAdd} />);

    userEvent.type(getInput(), 'Learn Docker');
    userEvent.click(getButton());
    await screen.findByRole('alert');

    userEvent.click(getButton());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(onAdd).toHaveBeenCalledTimes(2);
  });
});
