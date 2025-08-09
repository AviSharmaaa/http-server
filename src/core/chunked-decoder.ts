export function createChunkedState(): ChunkedState {
    return {
        done: false,
        awaitingSize: true,
        nextChunkSize: 0,
        collected: [],
        trailerMode: false,
        trailerBuf: Buffer.alloc(0),
        partialLine: Buffer.alloc(0),
    };
}

/**
 * Feed bytes into the chunked decoder.
 * Returns number of bytes consumed from `buf`.
 */
export function feedChunked(state: ChunkedState, buf: Buffer): number {
  let offset = 0;

  while (offset < buf.length && !state.done) {
    if (state.trailerMode) {
      offset = parseTrailers(state, buf, offset);
      break; // Exit to let caller handle consumed bytes
    }

    if (state.awaitingSize) {
      offset = parseChunkSize(state, buf, offset);
      continue;
    }

    offset = parseChunkData(state, buf, offset);
  }

  return offset;
}

function parseTrailers(state: ChunkedState, buf: Buffer, offset: number): number {
  while (offset < buf.length) {
    const lineResult = readLine(state, buf, offset);
    if (!lineResult) {
      // Incomplete line, need more data
      return buf.length;
    }

    const { line, newOffset } = lineResult;
    offset = newOffset;

    if (line.length === 0) {
      // Empty line = end of trailers
      state.done = true;
      break;
    }

    // Save trailer line
    state.trailerBuf = Buffer.concat([
      state.trailerBuf,
      line,
      Buffer.from("\r\n")
    ]);
  }

  return offset;
}

function parseChunkSize(state: ChunkedState, buf: Buffer, offset: number): number {
  const lineResult = readLine(state, buf, offset);
  if (!lineResult) {
    // Need more data for complete size line
    return buf.length;
  }

  const { line, newOffset } = lineResult;
  const chunkSize = parseHexSize(line.toString("utf8"));

  state.nextChunkSize = chunkSize;
  state.awaitingSize = false;

  if (chunkSize === 0) {
    // Terminal chunk - switch to trailer mode
    state.trailerMode = true;
  }

  return newOffset;
}

function parseChunkData(state: ChunkedState, buf: Buffer, offset: number): number {
  const dataSize = state.nextChunkSize;
  const totalNeeded = dataSize + 2; // data + CRLF

  if (buf.length - offset < totalNeeded) {
    // Not enough data yet
    return buf.length;
  }

  // Extract chunk data
  const data = buf.subarray(offset, offset + dataSize);
  state.collected.push(data);
  offset += dataSize;

  // Verify trailing CRLF
  if (!startsWithCrlf(buf, offset)) {
    throw new Error("Missing CRLF after chunk data");
  }
  offset += 2;

  // Reset for next chunk
  state.awaitingSize = true;
  state.nextChunkSize = 0;

  return offset;
}

// Helper: Read a complete CRLF-terminated line
function readLine(state: ChunkedState, buf: Buffer, offset: number): { line: Buffer; newOffset: number } | null {
  const eol = indexOfCrlf(buf, offset);
  if (eol === -1) {
    // Incomplete line - save fragment
    state.partialLine = Buffer.concat([
      state.partialLine,
      buf.subarray(offset)
    ]);
    return null;
  }

  // Complete line found
  let line: Buffer;
  if (state.partialLine.length > 0) {
    // Join with previous fragment
    line = Buffer.concat([state.partialLine, buf.subarray(offset, eol)]);
    state.partialLine = Buffer.alloc(0);
  } else {
    line = buf.subarray(offset, eol);
  }

  return { line, newOffset: eol + 2 }; // +2 for CRLF
}

// Helper: Parse hex chunk size, ignoring extensions
function parseHexSize(line: string): number {
  const semi = line.indexOf(";");
  const hexStr = (semi === -1 ? line : line.slice(0, semi)).trim();

  if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
    throw new Error(`Invalid chunk size: ${hexStr}`);
  }

  return parseInt(hexStr, 16);
}


export function getChunkedBody(state: ChunkedState): Buffer | null {
    if (!state.done) return null;
    return Buffer.concat(state.collected);
}

function indexOfCrlf(buf: Buffer, from: number): number {
    for (let i = from; i + 1 < buf.length; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10) return i; // \r\n
    }
    return -1;
}

function startsWithCrlf(buf: Buffer, at: number): boolean {
    return at + 1 < buf.length && buf[at] === 13 && buf[at + 1] === 10;
}