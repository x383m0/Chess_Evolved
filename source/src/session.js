import { ClassicRules, RULESET } from './rules.js';
export const PROTOCOL = 1;
export class GameSession {
  constructor() { this.reset(); }
  reset() { this.rules = new ClassicRules(); this.gameId = crypto.randomUUID(); this.revision = 0; this.ending = null; this.drawOffer = null; this.rematch = []; }
  get result() { return this.ending || this.rules.result(); }
  snapshot() { return { protocol: PROTOCOL, ruleset: RULESET, gameId: this.gameId, revision: this.revision, history: this.rules.history, fen: this.rules.fen, ending: this.ending, drawOffer: this.drawOffer, rematch: [...this.rematch] }; }
  restore(s) {
    if (!s || s.protocol !== PROTOCOL || s.ruleset?.id !== RULESET.id || s.ruleset?.version !== RULESET.version || typeof s.gameId !== 'string' || !Number.isInteger(s.revision) || s.revision < 0 || !Array.isArray(s.rematch) || s.rematch.some(c => !['w','b'].includes(c)) || ![null,'w','b'].includes(s.drawOffer)) throw new Error('Incompatible game');
    if (s.ending && (!['w','b',null].includes(s.ending.winner) || !['Resignation','Draw by agreement'].includes(s.ending.reason))) throw new Error('Invalid result');
    const next = new ClassicRules(); next.restore(s.history, s.fen);
    this.rules = next; this.gameId = s.gameId; this.revision = s.revision; this.ending = s.ending; this.drawOffer = s.drawOffer; this.rematch = [...new Set(s.rematch)];
  }
  dispatch(action, actor, gameId = this.gameId, revision = this.revision) {
    if (!['w','b'].includes(actor) || gameId !== this.gameId || revision !== this.revision) throw new Error('Game changed; try again');
    if (!action || typeof action.type !== 'string') throw new Error('Invalid action');
    if (action.type === 'rematch') {
      if (!this.result) throw new Error('Finish this game first');
      if (!this.rematch.includes(actor)) this.rematch.push(actor);
      if (this.rematch.length === 2) this.reset(); else this.revision++;
      return;
    }
    if (this.result) throw new Error('Game is over');
    switch(action.type) {
      case 'move':
        if (actor !== this.rules.turn) throw new Error('Wait for your turn');
        this.rules.apply(action); this.drawOffer = null; break;
      case 'resign': this.ending = { winner: actor === 'w' ? 'b' : 'w', reason: 'Resignation' }; this.drawOffer = null; break;
      case 'offer-draw': if (this.drawOffer) throw new Error('A draw offer is already pending'); this.drawOffer = actor; break;
      case 'accept-draw': if (!this.drawOffer || this.drawOffer === actor) throw new Error('No opponent draw offer'); this.ending = { winner: null, reason: 'Draw by agreement' }; this.drawOffer = null; break;
      case 'decline-draw': if (!this.drawOffer || this.drawOffer === actor) throw new Error('No opponent draw offer'); this.drawOffer = null; break;
      default: throw new Error('Unsupported action');
    }
    this.revision++;
  }
}
