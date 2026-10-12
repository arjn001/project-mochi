# Key Moments

The moments in her day where Mochi notices and responds. Each one follows the
principles in VISION.md: gentle, never in the way, and nothing leaves without
her click.

## Opening VS Code
- **Trigger:** VS Code opens, once a day across all her windows (a day runs
  until 5:00).
- **What Mochi does:** greets her with something about her day, in at most
  three short sentences: the time of day, a warm welcome back after 2 or
  more days away (never counting them), and the project she last coded in,
  when she opens it again.
- **Example:** "Meow, good evening! Welcome back! I missed you. Back to
  homework-3?"
- **After the late-night hour:** "Hi, night owl!" instead of a time of day,
  since "Good night" sounds like goodbye.
- **Her name:** used in a greeting only when she has set one.
- **Where:** at the top of Mochi's panel, the same line all day (MOCHI-16),
  and a gentle notification that fades on its own only when the panel isn't
  visible. On her first-ever day, the first-run welcome (MOCHI-42) replaces
  it; never both.
- **Never:** a wall of text, a list of tips, counting or guilt about time
  away, in quiet mode, or when a focus session is already running. Chatty
  mode greets once a day too.

## Stuck on errors
- **Trigger:** an error stays in the file she's editing for 2 minutes, while
  she's actively typing in it. A warning that crashes when the code runs,
  like Python's `"y" is not defined`, counts as an error (MOCHI-66).
- **What Mochi does:** shows a soft "Need a paw?" at the end of the error's
  line. Hovering it offers "Explain with Mochi", which explains on the
  learning ladder: explain first, then a hint or the fix only if she asks.
- **Offered once per session:** an error is known by its message and the code
  around it, so it isn't offered again even if it moves. Nothing about her
  code is saved to disk.
- **Never:** in quiet mode, on ordinary warnings, in other files, say she's
  wrong, keep offering, or read her code without a click.

## Opening a Python project
- **Trigger:** she opens a folder she trusts that has Python files (or a
  `requirements.txt` or `pyproject.toml`), no virtual environment yet, and
  no other tool like Poetry or conda in charge. Saving her first Python file
  in an empty folder counts too.
- **What Mochi does:** offers once to set up a virtual environment,
  explaining in one line what that is. After a yes, it sets up `.venv`, then
  asks before installing packages or changing `.gitignore`.
- **Offered once per project, ever,** whatever she answers.
- **Never:** in quiet mode, in Restricted Mode, during a focus session,
  without Python installed, in a project that already has an environment,
  or when the Python extension is about to ask the same thing.

## Coding late
- **Trigger:** she's typing after the late hour, a setting that's 23:00 by
  default. Late night lasts until 5:00.
- **What Mochi does:** one nudge per night, across all her VS Code windows.
  - On a light theme, it offers to dim things, in the pack's words: "It's
    getting late. Want me to dim things with a darker theme?"
  - On a dark theme, or any high contrast theme (light or dark), it only
    keeps her company: "Night shift together. I'm right here if you need
    me." It never offers to change a high contrast theme.
- **Waits for focus:** never during a focus session she started. Her next
  typing after it ends gets the nudge.
- **Never:** in quiet mode, more than once a night, lecture about sleep, nag,
  or guilt-trip.

## Finishing something
Built in MOCHI-36 (agreed 2026-10-12).
- **Trigger:** she tells Mochi in the chat that she finished something: "I
  finished the for loop!", "done with question 3", "question 3 is done",
  "It finally works!". Mochi notices on her computer, with no AI, so it's
  free and works with no brain (`src/moments/finished.ts`).
- **Careful on purpose:** a missed "yay" is better than a wrong one, and
  "I'm done" often means giving up. Mochi never celebrates:
  - a question, or a message with "but", "why", "how", "error", "help",
    "not", "almost", or "yet";
  - frustration or distress: give up, quit, hate, tired, can't, cannot, ugh,
    stuck, still, wrong, broke, broken, fail, failed, doesn't, won't,
    worst, crying, never, and any "n't";
  - a vague thing: "this", "it", "everything", "coding", "this class", and
    the like;
  - a bare "I'm done" or "done!", unless there's a real cheer ("yay, done",
    "finally finished :)").
  Those go to the brain as usual, or get the no-brain line.
- **What Mochi does:**
  1. Celebrates the specific thing in her words, from the pack's
     `celebrate` lines: "Yay, you finished your homework! That earns a slow
     blink from me." ("my" is said back as "your"). With nothing to name,
     the `celebrateDone` line: "Yay, you did it! That earns a slow blink
     from me." Only plain words are repeated back, never anything that
     could become formatting or a link.
  2. Offers next steps as chips: **Check my work** (her selected code only,
     through the share gate; with Learning mode on, what's good plus hints,
     never fixes), **Take a break** (5 minutes in the mood line), and on a
     light theme, **Switch to a dark theme**.
- **Even in quiet mode or a focus session,** since she's the one who said
  it. Any answer being written stops first.
- **Never:** over-the-top praise for tiny things, celebrating frustration,
  or claiming it's done without checking when she asked for a check.

## Speak-up levels
Every moment respects her setting:
- **Quiet:** only the status bar mood changes. Mochi never speaks first.
- **Gentle (default):** the behavior described above.
- **Chatty:** more greetings, more small talk, and a fun fact now and then.

## Voice
Playful, warm, and a little bit cat.
- **Sounds like Mochi:**
  - "Meow, you look awesome and energetic today!"
  - A cat fact, or a fun fact related to what she's working on.
  - Anime references belong in the personal layer, not the default pack.
- **Doesn't sound like Mochi:**
  - Corporate: "Your task has been completed successfully."
  - Guilt: "You haven't coded in 5 days."
  - Counting absence: "It's been 3 days." Welcome her back without numbers.
  - Lecturing: "As I explained before, you need to..."
