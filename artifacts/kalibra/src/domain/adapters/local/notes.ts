import { useEffect, useState } from 'react';
import { initialNotes } from '@/data';
import type { Note } from '@/types';

const STORAGE_KEY = 'kalibra-notes';

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return initialNotes;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as Note[];
    }
  } catch {
    return initialNotes;
  }
  return initialNotes;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const createNote = () => {
    const id = `n${Date.now()}`;
    setNotes((current) => [{ id, title: 'Nova nota', subject: 'Rascunho', updatedAt: 'agora', content: '# Nova nota\n\n' }, ...current]);
    return id;
  };

  const saveNote = (id: string, title: string, content: string) =>
    setNotes((current) => current.map((note) => note.id === id ? { ...note, title, content, updatedAt: 'agora' } : note));

  return { notes, createNote, saveNote };
}
