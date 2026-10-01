import Peer from 'peerjs';
import { PROTOCOL } from './session.js';
const PREFIX = 'chess-evolved-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode() { return Array.from(crypto.getRandomValues(new Uint8Array(8)), v => ALPHABET[v % ALPHABET.length]).join(''); }
export function normalizeCode(s) { return s.trim().toUpperCase().replace(/[\s-]/g, ''); }
export class Multiplayer {
  constructor(callbacks, PeerClass = Peer) { this.cb = callbacks; this.PeerClass = PeerClass; this.peer = null; this.conn = null; this.timer = null; this.code = ''; this.connected = false; this.guestToken = null; this.ownToken = crypto.randomUUID(); this.isHost = false; this.candidates = new Set(); }
  status(text) { this.cb.status(text); }
  stop() {
    clearTimeout(this.timer); this.timer = null; this.connected = false;
    const peer = this.peer; this.peer = null; this.conn = null;
    for (const c of this.candidates) c.close(); this.candidates.clear();
    peer?.destroy();
  }
  host() { this.stop(); this.isHost = true; this.guestToken = null; this.code = roomCode(); this.start(PREFIX + this.code); return this.code; }
  join(code) {
    code = normalizeCode(code);
    if (!/^[A-Z2-9]{8}$/.test(code)) throw new Error('Enter the 8-character room code.');
    this.stop(); this.isHost = false; this.code = code;
    this.start(undefined);
  }
  retry() { if (this.isHost) { this.peer?.reconnect(); } else this.join(this.code); }
  start(id) {
    const peer = new this.PeerClass(id, { debug: 0 }); this.peer = peer;
    this.status(this.isHost ? 'Creating room…' : 'Connecting…');
    this.timer = setTimeout(() => { if (this.peer === peer && !this.connected) { this.status('Connection timed out. Check the code and try again.'); this.cb.failure?.(); } }, 20000);
    peer.on('open', () => {
      if (this.peer !== peer) return;
      if (this.isHost) { clearTimeout(this.timer); this.status('Waiting for a friend'); this.cb.room(this.code); }
      else this.attach(peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' }));
    });
    peer.on('connection', conn => {
      if (this.peer !== peer) { conn.close(); return; }
      if (!this.isHost) { conn.on('open', () => conn.close()); return; }
      this.attach(conn);
    });
    peer.on('disconnected', () => {
      if (this.peer !== peer) return;
      // An established data channel can survive signaling loss.
      if (!this.connected) this.status('Room service disconnected. Reconnecting…');
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', err => {
      if (this.peer !== peer) return;
      clearTimeout(this.timer);
      const messages = { 'peer-unavailable': 'Room not found. Ask your friend to keep their tab open.', 'unavailable-id': 'This room code is in use. Create a new room.', 'network': 'Could not reach the room service. Check your connection.', 'browser-incompatible': 'This browser does not support multiplayer.' };
      this.status(messages[err.type] || 'Connection failed. Please try again.'); this.cb.failure?.();
    });
  }
  attach(conn) {
    const owner = this.peer;
    this.candidates.add(conn);
    let accepted = false;
    const timeout = setTimeout(() => { if (!accepted) conn.close(); }, 15000);
    conn.on('open', () => { if (owner !== this.peer) return conn.close(); if (!this.isHost) conn.send({ type: 'hello', protocol: PROTOCOL, token: this.ownToken }); });
    conn.on('data', msg => {
      if (owner !== this.peer || !msg || typeof msg !== 'object' || JSON.stringify(msg).length > 200000) return;
      if (this.isHost && !accepted) {
        if (msg.type !== 'hello' || msg.protocol !== PROTOCOL || typeof msg.token !== 'string' || msg.token.length > 100) { conn.send({ type:'reject', message:'Different game version. Both players must update.' }); conn.close(); return; }
        if ((this.guestToken && msg.token !== this.guestToken) || (this.conn?.open && this.conn !== conn)) { conn.send({ type:'reject', message:'This room already has two players.' }); setTimeout(() => conn.close(), 100); return; }
        this.guestToken = msg.token; this.conn = conn; accepted = true; clearTimeout(timeout); clearTimeout(this.timer); this.connected = true; this.status('Connected'); this.cb.connected(); return;
      }
      if (!this.isHost && msg.type === 'reject') { this.status(msg.message); this.cb.failure?.(); conn.close(); return; }
      if (!this.isHost && !accepted) {
        if (msg.type !== 'state') return;
        this.conn = conn; accepted = true; clearTimeout(timeout); clearTimeout(this.timer); this.connected = true; this.status('Connected'); this.cb.connected();
      }
      if (accepted && this.conn === conn) this.cb.message(msg);
    });
    conn.on('close', () => {
      clearTimeout(timeout); this.candidates.delete(conn);
      if (owner !== this.peer || this.conn !== conn) return;
      this.conn = null; this.connected = false; this.status('Opponent disconnected — game paused'); this.cb.disconnected();
    });
    conn.on('error', () => { if (owner === this.peer) this.status('Connection interrupted. Try reconnecting.'); });
  }
  send(msg) { if (!this.conn?.open) return false; try { this.conn.send(msg); return true; } catch { this.status('Connection interrupted. Try reconnecting.'); return false; } }
}
