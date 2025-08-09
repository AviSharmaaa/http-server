interface ChunkedState {
    done: boolean;
    awaitingSize: boolean;
    nextChunkSize: number;
    collected: Buffer[];
    trailerMode: boolean;
    trailerBuf: Buffer;
    partialLine: Buffer; // for split size-lines across packets
};