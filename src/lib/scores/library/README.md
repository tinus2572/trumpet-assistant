# Score library

One YAML file per score, written in Bb trumpet notation (what the player reads).
To add a score, create `<id>.yaml` here: it shows up in the app on the next page load, with no code to touch.
A mistake in a file (unknown note, wrong difficulty…) fails the page with a message naming the file and the note.

```yaml
id: hot-cross-buns           # must match the file name
title: Hot Cross Buns
composer: Traditional        # optional
tags: [traditional]          # jazz, traditional, classical, christmas, exercise
difficulty: easy             # easy, medium, hard, impossible
tempo: 90                    # BPM, quarter notes per minute
signature: [4, 4]
pickup: 1                    # optional: beats in an incomplete first measure
notes:
  # Comments are free, use them to label phrases
  - { note: E, octave: 4, duration: 1 }
  - { note: Bb, octave: 4, duration: 0.5, rest: 0.5 }   # rest = silence before the note, in beats
  - { note: C, octave: 5, duration: "2/3" }              # fractions for triplets
  - { note: F#, octave: 4, duration: 2, lineBreak: true } # start a new staff line at this measure
```

- `note`: C, C#, D, D#, E, F, F#, G, G#, A, A#, B (flats like Bb or Eb work too).
- `duration`: in beats. 1 = quarter, 0.5 = eighth, 2 = half, 4 = whole.
