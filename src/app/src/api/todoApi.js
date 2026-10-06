import { API_BASE_URL } from '../config';

const TODOS_PATH = '/todos';

/** Error whose `message` is always safe to show to the user. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractErrorMessage(payload, status) {
  if (payload && typeof payload.detail === 'string') {
    return payload.detail;
  }
  if (payload && typeof payload === 'object') {
    const messages = Object.values(payload)
      .flat()
      .filter((message) => typeof message === 'string');
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return `Request failed (HTTP ${status}).`;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (error) {
    throw new ApiError('Unable to reach the server. Please check your connection and try again.');
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status);
  }
  return payload;
}

export async function listTodos() {
  const todos = await request(TODOS_PATH);
  if (!Array.isArray(todos)) {
    throw new ApiError('The server returned an unexpected response.');
  }
  return todos;
}

export function createTodo(description) {
  return request(TODOS_PATH, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}
