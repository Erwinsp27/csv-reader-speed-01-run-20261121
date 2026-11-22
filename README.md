[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Erwinsp27/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Erwinsp27/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# Faster csv-reader

A faster drop-in for make.fun's own csv-reader 1.0.0, written from the
competition's prose description of its behaviour on broken CSV files.

The solver reads the text once, left to right. Commas separate fields and a
double quote opens a quoted field only when it is the first character used
for that field. A lone carriage return outside quotes is dropped and
reported, a record ends at LF or CRLF, and an empty line is no record.
Inside a quoted field, CRLF and a lone CR both read as LF, doubled quotes
read as one quote, and anything after the closing quote up to the next
comma or line break is appended and reported. A quote that never closes
stays literal and the rest is read again as unquoted. Records after the
first are padded or cut to the first record's width, and every error is
reported in the order it is met, with a record's short or long row error
last for that record.

## Files

- `solve.js` — the solver, exporting `run`.
- `main.ts` — the harness driver, reading cases and writing answers.
- `package.json` — package manifest.
- `LICENSE` — MIT licence.

Answers are compared as JSON values, and two runs on the same cases
must write byte-identical output, so the driver writes one plain JSON
serialisation with no timestamps, no randomness and no pretty printing.
