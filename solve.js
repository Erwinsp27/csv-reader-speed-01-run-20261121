export function run(input) {
  // The harness always supplies a string and a boolean, but the
  // reference treats any other header value as "no header" and reads
  // the text as its string form; match both, cheaply.
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;
  let line = 1;
  let recordStartLine = 1;
  let fields = [];
  let recordEmpty = true;
  let afterComma = false;
  let width = -1;
  let first = true;
  let headerFormed = false;
  let columns = null;
  const rows = [];
  const errors = [];

  const prospectiveRow = () => (header && !headerFormed ? null : rows.length);

  const finalize = () => {
    if (first) {
      width = fields.length;
      if (header) {
        columns = fields;
        headerFormed = true;
      } else {
        rows.push(fields);
      }
      first = false;
    } else if (fields.length < width) {
      errors.push({ code: "short_row", line: recordStartLine, row: rows.length, fields: fields.length });
      while (fields.length < width) fields.push("");
      rows.push(fields);
    } else if (fields.length > width) {
      const extra = fields.slice(width);
      errors.push({ code: "long_row", line: recordStartLine, row: rows.length, extra });
      fields.length = width;
      rows.push(fields);
    } else {
      rows.push(fields);
    }
    fields = [];
    recordEmpty = true;
    afterComma = false;
    recordStartLine = line;
  };

  while (i < n) {
    // Fast path: a whole record on one line with no quote and no stray
    // CR can be split natively. A line holding a quote or a stray CR
    // falls through to the field-by-field reader below.
    if (recordEmpty && fields.length === 0 && !afterComma) {
      const lf = text.indexOf("\n", i);
      const end = lf < 0 ? n : lf;
      let eff = end;
      if (lf >= 0 && eff > i && text.charCodeAt(eff - 1) === 13) eff--;
      // Check only this line's own characters, so the check stays
      // linear in the line no matter how far the next quote or CR is.
      const segment = text.slice(i, eff);
      if (segment.indexOf('"') < 0 && segment.indexOf("\r") < 0) {
        if (eff > i) {
          fields = segment.split(",");
          finalize();
        }
        i = lf < 0 ? n : lf + 1;
        if (lf >= 0) {
          line++;
          recordStartLine = line;
        }
        continue;
      }
    }
    // Empty line: no characters at all before the line break.
    if (recordEmpty && fields.length === 0 && !afterComma) {
      const c = text.charCodeAt(i);
      if (c === 10) {
        i++;
        line++;
        recordStartLine = line;
        continue;
      }
      if (c === 13 && text.charCodeAt(i + 1) === 10) {
        i += 2;
        line++;
        recordStartLine = line;
        continue;
      }
    }

    let fieldVal;
    let terminator; // 0 = comma, 1 = end of line, 2 = end of text
    let quoted = false;

    if (text.charCodeAt(i) === 34) {
      // Look ahead for a closing quote: a quote followed by another quote
      // is an escaped quote, anything else closes the field.
      let scan = i + 1;
      let closing = -1;
      while (scan < n) {
        const q = text.indexOf('"', scan);
        if (q < 0) break;
        if (text.charCodeAt(q + 1) === 34) {
          scan = q + 2;
          continue;
        }
        closing = q;
        break;
      }
      if (closing < 0) {
        errors.push({ code: "unterminated_quote", line: recordStartLine, row: prospectiveRow() });
        // Fall through to the unquoted reader, starting at the opening
        // quote itself, which stays literal.
      } else {
        quoted = true;
        const interior = text.slice(i + 1, closing);
        let value;
        if (interior.indexOf('"') < 0 && interior.indexOf("\r") < 0 && interior.indexOf("\n") < 0) {
          value = interior;
        } else {
          const breaks = interior.match(/\r\n?|\n/g);
          if (breaks) line += breaks.length;
          value = interior.replace(/\r\n?/g, "\n").replace(/""/g, '"');
        }
        // Junk after the closing quote, up to a comma or a line break.
        let j = closing + 1;
        let junk = null;
        let junkSeen = false;
        terminator = 2;
        while (j < n) {
          const comma = text.indexOf(",", j);
          const lf = text.indexOf("\n", j);
          const cr = text.indexOf("\r", j);
          let d = -1;
          let kind = 0;
          if (comma >= 0 && (d < 0 || comma < d)) { d = comma; kind = 0; }
          if (lf >= 0 && (d < 0 || lf < d)) { d = lf; kind = 1; }
          if (cr >= 0 && (d < 0 || cr < d)) { d = cr; kind = 2; }
          if (d < 0) {
            if (j < n) {
              const seg = text.slice(j, n);
              if (seg.length > 0) { junkSeen = true; junk = junk === null ? seg : junk + seg; }
            }
            j = n;
            terminator = 2;
            break;
          }
          if (kind === 2) {
            if (text.charCodeAt(d + 1) === 10) {
              if (d > j) {
                const seg = text.slice(j, d);
                junkSeen = true;
                junk = junk === null ? seg : junk + seg;
              }
              j = d + 2;
              line++;
              terminator = 1;
              break;
            }
            errors.push({ code: "stray_cr", line: recordStartLine, row: prospectiveRow() });
            if (d > j) {
              const seg = text.slice(j, d);
              junkSeen = true;
              junk = junk === null ? seg : junk + seg;
            }
            j = d + 1;
            continue;
          }
          if (d > j) {
            const seg = text.slice(j, d);
            junkSeen = true;
            junk = junk === null ? seg : junk + seg;
          }
          j = d + 1;
          if (kind === 1) line++;
          terminator = kind === 0 ? 0 : 1;
          break;
        }
        if (junkSeen) {
          errors.push({ code: "quote_junk", line: recordStartLine, row: prospectiveRow() });
        }
        fieldVal = junk === null ? value : value + junk;
        i = j;
      }
    }

    if (!quoted) {
      // Unquoted field: slice up to the nearest comma, LF or CR.
      let segStart = i;
      let parts = null;
      terminator = 2;
      while (true) {
        const comma = text.indexOf(",", i);
        const lf = text.indexOf("\n", i);
        const cr = text.indexOf("\r", i);
        let d = -1;
        let kind = 0;
        if (comma >= 0 && (d < 0 || comma < d)) { d = comma; kind = 0; }
        if (lf >= 0 && (d < 0 || lf < d)) { d = lf; kind = 1; }
        if (cr >= 0 && (d < 0 || cr < d)) { d = cr; kind = 2; }
        if (d < 0) {
          const seg = text.slice(segStart, n);
          fieldVal = parts === null ? seg : parts.join("") + seg;
          i = n;
          terminator = 2;
          break;
        }
        if (kind === 2) {
          if (text.charCodeAt(d + 1) === 10) {
            const seg = text.slice(segStart, d);
            fieldVal = parts === null ? seg : parts.join("") + seg;
            i = d + 2;
            line++;
            terminator = 1;
            break;
          }
          errors.push({ code: "stray_cr", line: recordStartLine, row: prospectiveRow() });
          if (parts === null) parts = [];
          parts.push(text.slice(segStart, d));
          i = d + 1;
          segStart = i;
          continue;
        }
        const seg = text.slice(segStart, d);
        fieldVal = parts === null ? seg : parts.join("") + seg;
        i = d + 1;
        if (kind === 1) line++;
        terminator = kind === 0 ? 0 : 1;
        break;
      }
    }

    if (terminator === 0) {
      fields.push(fieldVal);
      recordEmpty = false;
      afterComma = true;
      continue;
    }
    // End of line or end of text. A quoted field counts as a field even
    // when it is empty; only an unquoted line with no characters is no
    // record. (A stray CR on such a line was already reported above.)
    if (!quoted && recordEmpty && fields.length === 0 && !afterComma && fieldVal === "" && terminator !== 2) {
      recordStartLine = line;
      continue;
    }
    if (terminator === 2 && !quoted && recordEmpty && fields.length === 0 && !afterComma && fieldVal === "") {
      // End of text after only stray CRs on the last line: no record.
      // Stray errors were already reported; nothing to finalise.
      break;
    }
    fields.push(fieldVal);
    recordEmpty = false;
    finalize();
  }

  // A trailing comma leaves one pending empty field.
  if (afterComma) {
    fields.push("");
    finalize();
  }

  if (first) {
    columns = header ? [] : null;
  }
  return { columns, rows, errors };
}
