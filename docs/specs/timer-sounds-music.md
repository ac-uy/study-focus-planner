# Timer, sounds and music

## Timer
- Three modes: timer (presets 10 to 120 minutes or any 1 to 300), stopwatch, and pomodoro (focus and break lengths from her profile, defaults 25 and 5).
- Optional subject and title per session.
- Time studied is saved as a session when she finishes or resets, if it is at least one minute. The pomodoro saves each focus block.
- It keeps running when she changes page: a small timer chip stays visible. The browser tab title shows the countdown. A short chime plays at the end.

## Background sounds
- 29 options plus none, grouped as coloured noise, nature, ambient, music and binaural.
- Sounds play while a focus block or timer is running, or while she previews one. Volume is remembered.
- 16 are recordings from Wikimedia Commons, **public domain or CC0 only**, kept as small MP3 files in the app: rain, rain on the window, storm, wind, birds, forest, dawn chorus, fountain, café, keyboard, clock, and five classical pieces (Schumann, Satie in three sets, Debussy). They loop with a crossfade. A credits list is on the timer page.
- The rest are generated in the browser: white, pink, brown, blue and violet noise, waves, stream, crickets, elevator music, and four binaural tones (headphones needed).
- If a recording cannot be fetched or decoded, a generated sound of the same kind plays instead.
- At most two decoded recordings are kept in memory.
- `web-next/tools/prep-sounds.mjs` downloads and converts the recordings and refuses any file whose licence is not public domain or CC0.

## Music (needs sign-in)
- She types an artist, song or style. The server checks the text, searches YouTube, screens the results, and returns up to 25. Eight show as cards, all 25 form the queue.
- Playing uses YouTube's own player inside a dock that stays on screen while she moves around the app.
- When a song ends, the next one in the list plays at no API cost. When the list ends, one follow-up search for songs like the last one runs (100 YouTube quota units) and skips songs already played. She can turn this off. A skip button moves on at any time.
- A pasted YouTube link is checked by the server before it plays.
- A video that cannot be played is skipped.
- The player tries YouTube's privacy-enhanced address first. If it never starts within about 12 seconds it tries the standard address once and remembers which worked. If both fail it says the device is not letting YouTube play (for example a school-managed device) and stops there.
- If the player script cannot load, a plain embed is used and the music does not move on by itself.

## Content filters
See `safety-costs.md`.

## Tests
`tests/sound.test.mjs` (loop scheduling, crossfade, fallbacks, memory), `tests/music.test.js` (server filters), `tests/app.test.js` (player queue, follow-up search, fallback, blocked message).

## Known gaps
Audio quality has only been checked by automated tests, not by ear. Two recordings were removed after she disliked them. Some devices block YouTube and nothing in the app overrides that.
