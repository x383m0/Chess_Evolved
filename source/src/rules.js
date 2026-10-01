import { Chess } from 'chess.js';

// Rule adapters own legality and position serialization. The UI and transport
// exchange actions, so a future variant can replace this adapter in one place.
export const RULESET = { id: 'classic', version: 1, name: 'Classic chess' };
export const PIECES = {
  p: { name: 'Pawn', glyph: '♟', value: 1 }, n: { name: 'Knight', glyph: '♞', value: 3 },
  b: { name: 'Bishop', glyph: '♝', value: 3 }, r: { name: 'Rook', glyph: '♜', value: 5 },
  q: { name: 'Queen', glyph: '♛', value: 9 }, k: { name: 'King', glyph: '♚', value: 0 },
};
export class ClassicRules {
  constructor() { this.chess = new Chess(); }
  get turn() { return this.chess.turn(); }
  get fen() { return this.chess.fen(); }
  get history() { return this.chess.history(); }
  piece(square) { return this.chess.get(square); }
  legalMoves(square) { return this.chess.moves({ square, verbose: true }); }
  apply(action) {
    if (!action || action.type !== 'move' || !/^[a-h][1-8]$/.test(action.from) || !/^[a-h][1-8]$/.test(action.to)) throw new Error('Invalid move');
    if (action.promotion && !['q', 'r', 'b', 'n'].includes(action.promotion)) throw new Error('Invalid promotion');
    return this.chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' });
  }
  restore(history, fen) {
    if (!Array.isArray(history) || history.length > 3000) throw new Error('Invalid history');
    const next = new Chess();
    history.forEach(move => { if (typeof move !== 'string' || move.length > 16) throw new Error('Invalid history'); next.move(move); });
    if (next.fen() !== fen) throw new Error('Position mismatch');
    this.chess = next;
  }
  result() {
    const c = this.chess;
    if (c.isCheckmate()) return { winner: c.turn() === 'w' ? 'b' : 'w', reason: 'Checkmate' };
    if (c.isStalemate()) return { winner: null, reason: 'Stalemate' };
    if (c.isThreefoldRepetition()) return { winner: null, reason: 'Threefold repetition' };
    if (c.isInsufficientMaterial()) return { winner: null, reason: 'Insufficient material' };
    if (c.isDrawByFiftyMoves()) return { winner: null, reason: '50-move rule' };
    return null;
  }
  get inCheck() { return this.chess.isCheck(); }
}
