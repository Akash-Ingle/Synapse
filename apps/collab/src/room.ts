import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import type { WebSocket } from "ws";
import { config } from "./config.js";
import { loadYDocState, saveYDocState } from "./db.js";
import { extractPlainText } from "./text.js";

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

/** One in-memory collaboration room per document, holding the authoritative Y.Doc. */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  private readonly conns = new Map<WebSocket, Set<number>>();
  private dirty = false;
  private persistTimer: NodeJS.Timeout | null = null;
  private loaded = false;

  constructor(readonly documentId: string) {
    this.awareness.setLocalState(null);
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.broadcastSync(update, origin);
      this.schedulePersist();
    });
    this.awareness.on("update", (changes: AwarenessChanges, origin: unknown) => {
      this.broadcastAwareness(changes, origin);
    });
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const state = await loadYDocState(this.documentId);
    if (state) Y.applyUpdate(this.doc, state, "db");
    this.loaded = true;
  }

  addConnection(ws: WebSocket, canWrite: boolean): void {
    this.conns.set(ws, new Set());

    // Step 1: send our state vector so the client can compute a diff.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(ws, encoding.toUint8Array(encoder));

    // Send current awareness (presence) of everyone in the room.
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const aEncoder = encoding.createEncoder();
      encoding.writeVarUint(aEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(states.keys())),
      );
      this.send(ws, encoding.toUint8Array(aEncoder));
    }

    ws.on("message", (data: ArrayBuffer | Buffer) => this.onMessage(ws, new Uint8Array(data as Buffer), canWrite));
    ws.on("close", () => this.removeConnection(ws));
  }

  private onMessage(ws: WebSocket, message: Uint8Array, canWrite: boolean): void {
    try {
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          // Handle sync sub-messages manually so we can serve content to read-only
          // clients while ignoring any document mutations they attempt.
          const syncType = decoding.readVarUint(decoder);
          if (syncType === syncProtocol.messageYjsSyncStep1) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            syncProtocol.writeSyncStep2(encoder, this.doc, decoding.readVarUint8Array(decoder));
            this.send(ws, encoding.toUint8Array(encoder));
          } else if (
            syncType === syncProtocol.messageYjsSyncStep2 ||
            syncType === syncProtocol.messageYjsUpdate
          ) {
            if (canWrite) {
              Y.applyUpdate(this.doc, decoding.readVarUint8Array(decoder), ws);
            }
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            decoding.readVarUint8Array(decoder),
            ws,
          );
          break;
        }
      }
    } catch (err) {
      console.error(`[room ${this.documentId}] message error`, err);
    }
  }

  private broadcastSync(update: Uint8Array, origin: unknown): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);
    for (const ws of this.conns.keys()) {
      if (ws !== origin) this.send(ws, payload);
    }
  }

  private broadcastAwareness(changes: AwarenessChanges, _origin: unknown): void {
    const changed = [...changes.added, ...changes.updated, ...changes.removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
    );
    const payload = encoding.toUint8Array(encoder);
    for (const ws of this.conns.keys()) this.send(ws, payload);
  }

  private removeConnection(ws: WebSocket): void {
    const controlled = this.conns.get(ws);
    this.conns.delete(ws);
    if (controlled && controlled.size > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlled), "conn-closed");
    }
    if (this.conns.size === 0) {
      // Persist immediately when the last collaborator leaves.
      void this.persist();
    }
  }

  private schedulePersist(): void {
    this.dirty = true;
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, config.persistDebounceMs);
  }

  private async persist(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      const text = extractPlainText(this.doc);
      await saveYDocState(this.documentId, state, text);
    } catch (err) {
      console.error(`[room ${this.documentId}] persist error`, err);
      this.dirty = true;
    }
  }

  get isEmpty(): boolean {
    return this.conns.size === 0;
  }

  private send(ws: WebSocket, data: Uint8Array): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(data, (err) => {
      if (err) this.removeConnection(ws);
    });
  }
}

interface AwarenessChanges {
  added: number[];
  updated: number[];
  removed: number[];
}
