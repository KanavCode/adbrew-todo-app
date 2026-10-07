# ToDo App

A small full-stack ToDo application: a **React** frontend, a **Django REST** API and **MongoDB**,
all started with Docker Compose. You can add todos, mark them as completed, edit them inline and
delete them; everything is stored in MongoDB.

| Part     | Tech                                  | URL                         |
|----------|---------------------------------------|-----------------------------|
| Frontend | React 17 (hooks only), react-scripts 4 | http://localhost:3000       |
| API      | Django 3 + Django REST Framework, `pymongo` | http://localhost:8000/todos |
| Database | MongoDB 4.4                           | `localhost:27017`           |

## Quick start

Requirements: [Docker](https://docs.docker.com/get-docker/) with Docker Compose. Nothing else
needs to be installed.

```bash
git clone https://github.com/KanavCode/adbrew-todo-app.git
cd adbrew-todo-app

docker compose build     # first time only (or after changing the Dockerfile); takes a few minutes
docker compose up -d
```

The **first start takes a few minutes**: the `app` container runs `yarn install` before the
dev server comes up. Follow its progress with `docker logs -f app`; it is ready when you see
`Compiled successfully!`. Then open http://localhost:3000.

This needs Docker Compose v2 (the `docker compose` command that ships with Docker Desktop).
On Apple Silicon (M-series) Macs the containers run as `linux/amd64` under emulation, because
the MongoDB 4.4 packages used here are not published for arm64; the first build is slower there.

Useful commands:

```bash
docker ps                         # api, app and mongo should all be "Up"
docker logs -f --tail=100 api     # follow a container's logs (api | app | mongo)
docker exec -it api bash          # open a shell inside a container
docker restart api                # restart one container
docker compose down               # stop everything (data is kept, see "Data" below)
```

> **Where is the code mounted from?** `docker-compose.yml` mounts `./src` into the containers.
> If your checkout lives elsewhere you can still set `ADBREW_CODEBASE_PATH` to the absolute path of
> the `src` directory (`export ADBREW_CODEBASE_PATH=...` in bash,
> `$env:ADBREW_CODEBASE_PATH="..."` in PowerShell); it defaults to `./src`.

## How the Docker setup works

```
 browser ──► localhost:3000 ──► [ app ]  React dev server (yarn start)
    │
    └──────► localhost:8000 ──► [ api ]  Django runserver ──► mongo:27017 ──► [ mongo ]  mongod
                                                  (Docker network, resolved by service name)
```

**One image, three containers.** The `Dockerfile` builds a single image containing Python, Node/Yarn
and MongoDB. `docker-compose.yml` starts it three times with a different `command` each, so each
container plays one role:

| Service | Command                                      | Role                      |
|---------|----------------------------------------------|---------------------------|
| `api`   | `python manage.py runserver 0.0.0.0:8000`    | Django REST API           |
| `app`   | `yarn install && yarn start`                 | React development server  |
| `mongo` | `mongod --bind_ip 0.0.0.0`                   | Database                  |

(`0.0.0.0` makes a server listen on all interfaces; with the default `127.0.0.1` it would not be
reachable from outside its container.)

**Bind mounts, not copies.** The source code is *mounted* into the containers (`./src` → `/src`)
instead of being baked into the image. The image only contains dependencies (it copies just
`src/requirements.txt`), so editing a file on the host takes effect immediately in the running
container, and Django's auto-reloader / the React dev server pick it up. The image only needs
rebuilding when the `Dockerfile` or the Python requirements change.

**Networking.** Compose puts the containers on one network where each service is reachable by its
name. The `api` therefore connects to Mongo at `mongo:27017`, built from the `MONGO_HOST` and
`MONGO_PORT` environment variables defined in the `Dockerfile`. The *browser* is outside that
network, so the frontend calls the API through the port published on the host
(`http://localhost:8000`), not `http://api:8000`. CORS is enabled in the API for that reason: the
page (`:3000`) and the API (`:8000`) are different origins.

**Data.** MongoDB's files live in `./src/db` (mounted to `/data/db`), so todos survive
`docker compose down` and container restarts. To start from an empty database, run
`docker compose down` and delete `src/db`. That folder is git-ignored.

### Changes made to the provided Docker setup

The original setup no longer builds as-is, so a few things were fixed:

1. **Base image pinned to `python:3.8-bullseye`.** The floating `python:3.8` tag now points at
   Debian 12 (bookworm), which has no `libssl1.1` (needed by the MongoDB 4.4 packages) and ships a
   Node version too new for `react-scripts 4` (webpack 4 fails with `ERR_OSSL_EVP_UNSUPPORTED`).
2. **apt pointed at `archive.debian.org`.** Debian 11 is end-of-life and its security repository was
   removed from the main mirror (404s during `apt-get install`). The archive's `Release` files are
   expired, hence `Acquire::Check-Valid-Until "false"`.
3. **`easy_install pip` replaced by `pip --version`.** `easy_install` was removed from recent
   `setuptools`, and the Python image already ships `pip`.
4. **`CHOKIDAR_USEPOLLING=true` on the `app` service.** On Docker Desktop (Windows/macOS) file-change
   events do not cross bind mounts, so the React dev server stopped noticing edits. Polling fixes
   hot reload.
5. **`ADBREW_CODEBASE_PATH` defaults to `./src`** so no environment variable has to be exported
   before running Compose (the original `export ...` command is bash-only).
6. **`.dockerignore` added.** The build only needs `requirements.txt`, but the whole repository
   (including `node_modules` and the Mongo data files, hundreds of MB) was being sent to the Docker
   daemon on every build.
7. **`platform: linux/amd64` on every service.** The MongoDB 4.4 packages are x86-64 only, so on
   arm64 hosts (Apple Silicon) the image build would fail. Pinning the platform makes Docker
   emulate amd64 there; on amd64 machines it changes nothing.

## API

Base URL: `http://localhost:8000`. The API speaks JSON only. A trailing slash is optional
(`/todos` and `/todos/` are equivalent).

A todo looks like this:

```json
{ "id": "6ac4c8d97373e7ac5d2129d3", "description": "Learn Docker", "completed": false, "created_at": "2026-10-06T10:09:29.689000Z" }
```

| Method & path           | Purpose                              | Success                |
|-------------------------|--------------------------------------|------------------------|
| `GET /todos`            | List all todos, oldest first         | `200` + array of todos |
| `POST /todos`           | Create a todo                        | `201` + the new todo   |
| `PATCH /todos/<id>`     | Change `description` and/or `completed` | `200` + the updated todo |
| `DELETE /todos/<id>`    | Delete a todo                        | `204`, no body         |

The description is trimmed and must be a non-blank string of at most 200 characters.
`completed` must be a real boolean. `PATCH` is a partial update: send only what changes, and at
least one of the two fields.

```bash
curl -X POST http://localhost:8000/todos \
     -H "Content-Type: application/json" \
     -d '{"description": "Learn React"}'

curl -X PATCH http://localhost:8000/todos/<id> \
     -H "Content-Type: application/json" \
     -d '{"completed": true}'

curl -X DELETE http://localhost:8000/todos/<id>
```

### Errors

| Status | When                                                  | Body                                              |
|--------|-------------------------------------------------------|---------------------------------------------------|
| 400    | Missing/blank/non-string/too long description, `completed` not a boolean, empty `PATCH`, malformed JSON | `{"description": ["This field may not be blank."]}` or `{"detail": "..."}` |
| 404    | `PATCH`/`DELETE` of an id that does not exist (or is not a valid id) | `{"detail": "Todo not found."}`      |
| 405    | Method not supported on that URL                      | `{"detail": "Method \"GET\" not allowed."}`       |
| 415    | Body is not JSON                                      | `{"detail": "Unsupported media type ..."}`        |
| 503    | MongoDB is unreachable (answered within ~3 seconds)   | `{"detail": "The todo store is temporarily unavailable. ..."}` |

Storage errors are logged on the server; the client only ever sees the generic 503 message.

## Project structure

```
src/
├── requirements.txt          Python dependencies (installed into the image)
├── rest/                     Django project (the API)
│   └── rest/
│       ├── urls.py           routes + wiring: creates the repository and injects it into the view
│       ├── views.py          TodoListView / TodoDetailView: HTTP only (validate → repository → respond)
│       ├── validators.py     request validation (plain Python)
│       ├── repositories.py   TodoRepository: the only code that talks to MongoDB
│       ├── db.py             MongoDB connection (env config, one shared client, short timeout)
│       ├── exceptions.py     TodoStorageError / TodoNotFound (storage layer) and the 503 API exception
│       ├── settings.py
│       └── tests/            backend tests
└── app/                      React app
    └── src/
        ├── config.js         API base URL, input length limit
        ├── api/todoApi.js    fetch wrapper: list / create / update / delete, error normalisation
        ├── hooks/useTodos.js state + data fetching for the list
        ├── components/       TodoForm, TodoList, TodoItem (one row: toggle, inline edit, delete)
        └── App.js            composition
```

## Design notes

**Backend**

- **Layers with one job each.** The view knows HTTP, the repository knows MongoDB, the validator
  knows the rules. None of them knows about the others' internals.
- **Dependency injection.** The view receives its repository through `as_view(repository=...)`.
  Tests inject an in-memory fake, and changing the storage engine means writing one new class.
- **No Django ORM.** As required, models, serializers and SQLite are not used (`DATABASES = {}`);
  all data is read and written with `pymongo`.
- **Centralised error handling.** The repository wraps driver errors in `TodoStorageError` and
  reports a missing todo as `TodoNotFound`; a shared base view's `handle_exception` turns them into
  503 and 404 in one place instead of a `try/except` per method.
- **Extensible by design.** Adding update/delete only needed new repository methods, one more view
  and a validator; the existing layers were not rewritten.
- **Safe ids.** A malformed id cannot match any document, so it is answered with the same JSON 404
  as an unknown id (never a 500 or an HTML error page).
- **Backwards compatible data.** Todos stored before `completed` existed are read as not completed.
- **Fail fast.** The Mongo client uses a 3 s server-selection timeout, so an outage produces a quick
  503 instead of a 30 s hang, and the API recovers by itself when Mongo comes back.
- **Mongo → JSON.** `ObjectId` is exposed as a string `id`; timestamps are timezone-aware UTC,
  truncated to milliseconds (MongoDB's precision) so `POST` and `GET` return identical values.

**Frontend**

- **Hooks only**, no class components. `useTodos` owns the data (`todos`, `isLoading`, `error`,
  `addTodo`, `changeTodo`, `removeTodo`, `refresh`); components only render.
- **The list is reloaded from the backend after each successful change** (add, toggle, edit,
  delete), so what is on screen is always what is stored.
- **Per-row state.** Each `TodoItem` tracks its own busy/error state: its controls are disabled while
  its request is in flight, and a failure is shown next to that row without affecting the others.
- **One error type.** `todoApi.js` converts network failures, validation errors, 503s and non-JSON
  error pages into an `Error` with a readable message; the UI just shows `error.message`.
- **Race safety.** The hook ignores responses from outdated requests and from unmounted components.
- **Good form behaviour.** Input is trimmed, the button is disabled while empty or submitting, typed
  text is kept when a submit fails, and errors are announced with `role="alert"`.

## Tests

Both suites run inside the containers (so the exact same environment as the app):

```bash
# Backend: 42 tests (validators, views with a fake repository, repository against the real MongoDB)
docker exec api bash -c "cd /src/rest && python manage.py test"

# Frontend: 52 tests (API layer, form, list, todo row, and the whole App with the network mocked)
docker exec -e CI=true app bash -c "cd /src/app && yarn test --watchAll=false"
```

The repository tests use a throw-away database that is dropped afterwards, so your todos are not
touched. The frontend suite can take a minute or two on Windows/macOS because of the bind mount.

## Troubleshooting

- **`localhost:3000` does not load right after `up`:** `yarn install` is still running; check
  `docker logs -f app`.
- **Port already in use (3000, 8000 or 27017):** stop whatever is using it, or the previous stack
  with `docker compose down`.
- **Changes to the React code do not show up:** make sure `CHOKIDAR_USEPOLLING=true` is present on the
  `app` service and recreate it with `docker compose up -d app`.
- **API returns 503:** MongoDB is not reachable. Check `docker ps` / `docker logs mongo`.
- **Build fails while running `apt-get`:** see "Changes made to the provided Docker setup" above.

## Possible improvements

- Pagination and an index on `created_at` once lists grow (the API currently returns all todos).
- Request cancellation in the frontend with `AbortController`, and optimistic updates for toggling.
- Use the official `mongo` image for the database instead of installing MongoDB in the shared image,
  and a multi-stage production build (static React build behind nginx, gunicorn for Django).
- Expose limits such as the maximum description length through the API instead of duplicating them.
