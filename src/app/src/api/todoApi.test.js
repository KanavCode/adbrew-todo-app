import { API_BASE_URL } from '../config';
import { createTodo, listTodos } from './todoApi';

// CRA resets mocks before every test, so each test installs its own fetch behaviour.
function mockFetchResponse({ ok = true, status = 200, body }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () =>
      body === undefined ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body),
  });
}

afterEach(() => {
  delete global.fetch;
});

describe('listTodos', () => {
  it('GETs /todos and returns the todos', async () => {
    const todos = [{ id: '1', description: 'Learn Docker', created_at: '2026-10-06T10:00:00Z' }];
    mockFetchResponse({ body: todos });

    await expect(listTodos()).resolves.toEqual(todos);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/todos`, expect.any(Object));
  });

  it('rejects when the server does not return an array', async () => {
    mockFetchResponse({ body: { unexpected: true } });

    await expect(listTodos()).rejects.toThrow('The server returned an unexpected response.');
  });
});

describe('createTodo', () => {
  it('POSTs the description as JSON and returns the created todo', async () => {
    const created = { id: '2', description: 'Learn React', created_at: '2026-10-06T10:00:00Z' };
    mockFetchResponse({ status: 201, body: created });

    await expect(createTodo('Learn React')).resolves.toEqual(created);

    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/todos`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ description: 'Learn React' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });
});

describe('error handling', () => {
  it('uses the "detail" message of the API when there is one', async () => {
    mockFetchResponse({ ok: false, status: 503, body: { detail: 'Store is down.' } });

    await expect(listTodos()).rejects.toMatchObject({ message: 'Store is down.', status: 503 });
  });

  it('joins field validation messages', async () => {
    mockFetchResponse({
      ok: false,
      status: 400,
      body: { description: ['This field may not be blank.', 'Another problem.'] },
    });

    await expect(createTodo('')).rejects.toMatchObject({
      message: 'This field may not be blank. Another problem.',
      status: 400,
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    mockFetchResponse({ ok: false, status: 502, body: undefined });

    await expect(listTodos()).rejects.toMatchObject({
      message: 'Request failed (HTTP 502).',
      status: 502,
    });
  });

  it('reports an unreachable server in plain language', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listTodos()).rejects.toThrow('Unable to reach the server');
  });
});
