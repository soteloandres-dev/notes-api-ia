import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface Note {
  id: number;
  title: string;
  content: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notesFilePath = path.join(__dirname, '..', 'data', 'notes.json');

function readNotes(): Note[] {
  try {
    const data = fs.readFileSync(notesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function writeNotes(notes: Note[]) {
  const dirPath = path.dirname(notesFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2));
}

const router = express.Router();

router.get('/', (req, res) => {
  const searchQuery = req.query.search?.toString().toLowerCase();
  const notes = readNotes();
  if (searchQuery) {
    const filteredNotes = notes.filter(note => note.title.toLowerCase().includes(searchQuery));
    return res.json(filteredNotes);
  }
  res.json(notes);
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const note = readNotes().find(note => note.id === id);
  if (note) {
    return res.json(note);
  }
  res.status(404).json({ message: 'Note not found' });
});

router.post('/', (req, res) => {
  const { title, content } = req.body;
  if (!title || title.length < 3) {
    return res.status(400).json({ message: 'Title must be at least 3 characters long' });
  }
  const currentNotes = readNotes();
  const newNote: Note = {
    id: currentNotes.length + 1,
    title,
    content: content || ''
  };
  writeNotes([...currentNotes, newNote]);
  res.status(201).json(newNote);
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content } = req.body;
  if (!title || title.length < 3) {
    return res.status(400).json({ message: 'Title must be at least 3 characters long' });
  }
  const notes = readNotes();
  const noteIndex = notes.findIndex(note => note.id === id);
  if (noteIndex !== -1) {
    notes[noteIndex] = { id, title, content };
    writeNotes(notes);
    return res.json(notes[noteIndex]);
  }
  res.status(404).json({ message: 'Note not found' });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const notes = readNotes();
  const noteIndex = notes.findIndex(note => note.id === id);
  if (noteIndex !== -1) {
    notes.splice(noteIndex, 1);
    writeNotes(notes);
    return res.status(204).send();
  }
  res.status(404).json({ message: 'Note not found' });
});

export default router;