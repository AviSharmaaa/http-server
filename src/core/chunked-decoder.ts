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

function parseHexSize(line: string): number | null {
    const hex = line.split(";")[0].trim();
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
    return parseInt(hex, 16);
}

/**
 * Feed bytes into the chunked decoder.
 * Returns number of bytes consumed from `buf`.
 */
export function feedChunked(state: ChunkedState, buf: Buffer): number {
    let offset = 0;

    while (offset < buf.length && !state.done) {
        if (state.trailerMode) {
            // Collect trailers until CRLFCRLF
            const idx = indexOfCrlfCrlf(buf, offset);
            if (idx === -1) {
                state.trailerBuf = Buffer.concat([state.trailerBuf, buf.subarray(offset)]);
                offset = buf.length;
                break;
            } else {
                state.trailerBuf = Buffer.concat([state.trailerBuf, buf.subarray(offset, idx + 4)]);
                offset = idx + 4;
                state.done = true;
                break;
            }
        }

        if (state.awaitingSize) {
            // Need a full size line ending with CRLF; handle splits
            const eol = indexOfCrlf(buf, offset);
            if (eol === -1) {
                state.partialLine = Buffer.concat([state.partialLine, buf.subarray(offset)]);
                offset = buf.length;
                break;
            } else {
                const lineBuf = Buffer.concat([state.partialLine, buf.subarray(offset, eol)]);
                state.partialLine = Buffer.alloc(0);

                const line = lineBuf.toString("utf8");
                offset = eol + 2;

                const size = parseHexSize(line);
                if (size === null) throw new Error("Invalid chunk size line");
                state.nextChunkSize = size;

                if (size === 0) {
                    // Terminal chunk: DO NOT consume anything here.
                    // Enter trailer mode and let it consume CRLFCRLF (empty trailers)
                    // or proper trailers followed by CRLF.
                    state.trailerMode = true;
                    continue;
                }

                state.awaitingSize = false; // next read will be chunk data (+ CRLF)
            }
        } else {
            // Read chunk data + trailing CRLF
            const need = state.nextChunkSize + 2; // data + CRLF
            const available = buf.length - offset;
            if (available < need) {
                // Not enough bytes for full chunk yet
                break;
            }

            const chunk = buf.subarray(offset, offset + state.nextChunkSize);
            state.collected.push(chunk);
            offset += state.nextChunkSize;

            // Expect CRLF after the data
            if (!startsWithCrlf(buf, offset)) {
                throw new Error("Missing CRLF after chunk data");
            }
            offset += 2;

            // Next iteration will read size line
            state.awaitingSize = true;
            state.nextChunkSize = 0;
        }
    }

    return offset;
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

function indexOfCrlfCrlf(buf: Buffer, from: number): number {
    for (let i = from; i + 3 < buf.length; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i; // \r\n\r\n
    }
    return -1;
}