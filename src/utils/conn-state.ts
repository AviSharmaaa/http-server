import * as net from "net";

const reqCount = new WeakMap<net.Socket, number>();

export function nextReqCount(s: net.Socket): number {
    const n = (reqCount.get(s) ?? 0) + 1;
    reqCount.set(s, n);
    return n;
}

export function getReqCount(s: net.Socket): number {
    return reqCount.get(s) ?? 0;
}

export function resetReqCount(s: net.Socket): void {
    reqCount.set(s, 0);
}
