# QuickNotes Data Model

## 1. Database choice

Use a relational SQL database such as PostgreSQL.

QuickNotes has clear relationships: users own notes and folders, and notes can have multiple tags. SQL provides foreign keys, unique constraints and transactions to protect these relationships. Notes also need predictable filtering and sorting by owner, folder and update time. A document database could store note documents, but it would make relationship enforcement and cross-resource queries less straightforward.

## 2. Four core entities and relationships

1. **Users** — account owners.
2. **Folders** — named collections owned by a user.
3. **Notes** — text records owned by a user; a note may optionally be in one folder.
4. **Tags** — labels owned by a user and reusable across that user's notes.

A note can have many tags, and a tag can label many notes. The `note_tags` junction table implements this many-to-many relationship. It is a relationship table, not a fifth core entity.

Relationships:
- One user has many notes.
- One user has many folders.
- One user has many tags.
- One folder has many notes; a note may have no folder.
- Notes and tags have a many-to-many relationship through `note_tags`.

## 3. SQL schema

The schema below targets PostgreSQL.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, name),
    UNIQUE (id, user_id)
);

CREATE TABLE notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id BIGINT,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notes_folder_owner_fk
      FOREIGN KEY (folder_id, user_id)
      REFERENCES folders(id, user_id)
      ON DELETE SET NULL (folder_id)
);

CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    UNIQUE (user_id, name),
    UNIQUE (id, user_id)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id, user_id)
      REFERENCES notes(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id)
      REFERENCES tags(id, user_id) ON DELETE CASCADE
);
```

The composite foreign keys prevent a user from attaching another user's folder or tag to their note. The folder foreign key uses PostgreSQL's column-specific `SET NULL` action so deleting a folder keeps the note and clears only `folder_id`.

## 4. Indexes

```sql
-- Supports a user's newest notes and cursor-style date ordering.
CREATE INDEX idx_notes_user_updated
    ON notes (user_id, updated_at DESC, id DESC);

-- Supports filtering notes inside a folder.
CREATE INDEX idx_notes_user_folder
    ON notes (user_id, folder_id);

-- Supports looking up all tags attached to a note.
CREATE INDEX idx_note_tags_tag
    ON note_tags (tag_id, note_id);
```

The primary keys and unique constraints already create indexes for their key columns. These additional indexes target common application queries. Indexes speed up reads but consume storage and add work to inserts, updates and deletes, so they should be reviewed using real query plans as usage grows.

## 5. Example queries

### Create a note

```sql
INSERT INTO notes (user_id, folder_id, title, body)
VALUES (1, 2, 'Project plan', 'Prepare the first project draft.')
RETURNING id, title, body, created_at, updated_at;
```

### List the latest notes for one user

```sql
SELECT id, title, body, folder_id, is_archived, created_at, updated_at
FROM notes
WHERE user_id = 1
ORDER BY updated_at DESC, id DESC
LIMIT 20;
```

### List notes in a folder

```sql
SELECT id, title, updated_at
FROM notes
WHERE user_id = 1 AND folder_id = 2
ORDER BY updated_at DESC;
```

### Find all tags on a note

```sql
SELECT t.id, t.name
FROM tags AS t
JOIN note_tags AS nt ON nt.tag_id = t.id
WHERE nt.note_id = 15 AND nt.user_id = 1
ORDER BY t.name;
```

### Count notes per folder, including empty folders

```sql
SELECT f.id, f.name, COUNT(n.id) AS note_count
FROM folders AS f
LEFT JOIN notes AS n
  ON n.folder_id = f.id AND n.user_id = f.user_id
WHERE f.user_id = 1
GROUP BY f.id, f.name
ORDER BY f.name;
```

### Update a note

```sql
UPDATE notes
SET title = 'Revised project plan',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 15 AND user_id = 1
RETURNING id, title, updated_at;
```

### Delete a note

```sql
DELETE FROM notes
WHERE id = 15 AND user_id = 1;
```

## 6. Data integrity and security

- Passwords are stored as secure password hashes, never plaintext.
- Every user-owned query is scoped by `user_id`.
- Foreign keys prevent orphaned records.
- Cascading deletes remove a user's notes, folders, tags and note-tag links when the account is deleted.
- The API validates title and body lengths before insertion.
- Database transactions should be used when a request changes multiple related records, such as creating a note and assigning tags.

## 7. SQL versus NoSQL conclusion

PostgreSQL is the recommended starting point because the data is relational, consistency matters, and the expected workload is manageable with indexes, connection pooling and read replicas. The team should measure query latency and growth before introducing sharding or a second database. NoSQL may be reconsidered if future requirements introduce highly variable document structures or access patterns that justify its additional complexity.
