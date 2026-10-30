const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.querySelector("#load-button");
const createButton = document.querySelector("#create-button");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#note-title");
const bodyInput = document.querySelector("#note-body");
const notesList = document.querySelector("#notes-list");
const statusMessage = document.querySelector("#status");

// JSONPlaceholder simulates POST and DELETE; it does not persist those changes.
let notes = [];

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "No notes found. Create a note or load notes from the server.";
    notesList.append(emptyMessage);
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = `Note ID: ${note.id}`;

    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled note";

    const body = document.createElement("p");
    body.textContent = note.body || "This note has no body.";

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNote(note.id, deleteButton));

    card.append(meta, title, body, deleteButton);
    notesList.append(card);
  });
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus("Loading notes...");

  try {
    const response = await fetch(`${API_URL}?_limit=10`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response format");

    notes = data;
    renderNotes();
    setStatus(notes.length === 0
      ? "The server returned no notes."
      : `Loaded ${notes.length} notes from the server.`);
  } catch (error) {
    setStatus("We couldn't load your notes. Check your connection and try again.", true);
    console.error("Load notes error:", error);
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title before creating your note.", true);
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", true);
    titleInput.focus();
    return;
  }

  createButton.disabled = true;
  setStatus("Creating note...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const createdNote = await response.json();

    // Add the returned note locally. Refreshing restores the fixture data because
    // JSONPlaceholder does not save POST requests.
    notes.unshift(createdNote);
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${response.status}, id ${createdNote.id}).`);
  } catch (error) {
    setStatus("We couldn't create your note. Please try again.", true);
    console.error("Create note error:", error);
  } finally {
    createButton.disabled = false;
  }
}

async function deleteNote(noteId, button) {
  button.disabled = true;
  setStatus(`Deleting note ${noteId}...`);

  try {
    const response = await fetch(`${API_URL}/${encodeURIComponent(noteId)}`, {
      method: "DELETE"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // The API confirms DELETE but does not persist it. Remove from this view only;
    // loading the list again restores the original JSONPlaceholder fixture.
    notes = notes.filter((note) => String(note.id) !== String(noteId));
    renderNotes();
    setStatus(`Note ${noteId} deleted from this view (status ${response.status}).`);
  } catch (error) {
    button.disabled = false;
    setStatus(`We couldn't delete note ${noteId}. Please try again.`, true);
    console.error("Delete note error:", error);
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
