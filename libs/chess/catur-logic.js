import { Chess as ChessJS } from 'chess.js';

class Chess {
  constructor(fen) {
    this.chess = new ChessJS(fen);
  }

  move(move) {
    try {
      return this.chess.move(move);
    } catch (e) {
      return null;
    }
  }

  moves(options) {
    return this.chess.moves(options);
  }

  fen() {
    return this.chess.fen();
  }

  board() {
    return this.chess.board();
  }

  turn() {
    return this.chess.turn();
  }

  isCheck() {
    return this.chess.isCheck();
  }

  isCheckmate() {
    return this.chess.isCheckmate();
  }

  isStalemate() {
    return this.chess.isStalemate();
  }

  isDraw() {
    return this.chess.isDraw();
  }

  isThreefoldRepetition() {
    return this.chess.isThreefoldRepetition();
  }

  isInsufficientMaterial() {
    return this.chess.isInsufficientMaterial();
  }

  history(options) {
    return this.chess.history(options);
  }

  get(square) {
    return this.chess.get(square);
  }

  reset() {
    this.chess.reset();
  }

  load(fen) {
    return this.chess.load(fen);
  }

  ascii() {
    return this.chess.ascii();
  }

  inCheck() {
    return this.chess.inCheck();
  }

  inCheckmate() {
    return this.chess.inCheckmate();
  }

  inStalemate() {
    return this.chess.inStalemate();
  }

  inDraw() {
    return this.chess.inDraw();
  }

  // ==================== COORDINATE SYSTEM ====================

  squareToCoords(square) {
    const file = square.charCodeAt(0) - 97; // a=0, b=1, ...
    const rank = 8 - parseInt(square[1]); // 8=0, 7=1, ...
    return { row: rank, col: file };
  }

  coordsToSquare(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    return file + rank;
  }

  isValidSquare(row, col) {
    return row >= 0 && row <= 7 && col >= 0 && col <= 7;
  }

  // ==================== SMART MOVE PARSER ====================

  parseAndMove(userInput) {
    let input = userInput.trim().replace(/\s+/g, '');

    if (input === '00' || input === 'O-O' || input === 'o-o' || input === 'OO') {
      const result = this.tryMove('O-O');
      if (result.success) return result;
    }
    if (input === '000' || input === 'O-O-O' || input === 'o-o-o' || input === 'OOO') {
      const result = this.tryMove('O-O-O');
      if (result.success) return result;
    }

    input = input.replace(/[+#!?]/g, '');

    let result = this.tryMove(input);
    if (result.success) return result;

    if (!input.includes('x')) {
      result = this.tryMove(this.addCaptureIfNeeded(input));
      if (result.success) return result;
    }

    if (input.includes('x')) {
      result = this.tryMove(input.replace('x', ''));
      if (result.success) return result;
    }

    if (this.isPawnPromotion(input)) {
      for (const piece of ['Q', 'R', 'N', 'B']) {
        result = this.tryMove(input + piece);
        if (result.success) return result;
      }
      result = this.tryMove(input + '=Q');
      if (result.success) return result;
    }

    const possibleMoves = this.moves({ verbose: true });
    const matchedMove = this.findBestMatch(input, possibleMoves);

    if (matchedMove) {
      result = this.tryMove(matchedMove.san);
      if (result.success) return result;
    }

    return {
      success: false,
      error: 'invalid_notation',
      input: userInput,
      suggestion: this.getSuggestion(input, possibleMoves)
    };
  }

  tryMove(moveStr) {
    try {
      const move = this.move(moveStr);
      if (move) {
        return { success: true, move };
      }
    } catch (e) {
      // Move invalid
    }
    return { success: false };
  }

  addCaptureIfNeeded(input) {
    const possibleMoves = this.moves({ verbose: true });
    const destMatch = input.match(/[a-h][1-8]$/);
    if (!destMatch) return input;

    const dest = destMatch[0];
    const captureMove = possibleMoves.find(m =>
      m.to === dest &&
      m.captured &&
      m.san.replace('x', '').replace(/[+#]/g, '') === input
    );

    if (captureMove) {
      return input.replace(/([a-h][1-8])$/, 'x$1');
    }

    return input;
  }

  isPawnPromotion(input) {
    const turn = this.turn();
    const promotionRank = turn === 'w' ? '8' : '1';

    if (input.endsWith(promotionRank)) {
      const firstChar = input.charAt(0);
      if ((firstChar >= 'a' && firstChar <= 'h') || input.length <= 3) {
        return true;
      }
    }

    return false;
  }

  findBestMatch(input, possibleMoves) {
    const inputLower = input.toLowerCase().replace(/[^a-h0-8x]/g, '');

    for (const move of possibleMoves) {
      const sanLower = move.san.toLowerCase().replace(/[^a-h0-8x]/g, '');
      if (sanLower === inputLower) return move;
      if (input.length === 2 && move.to === input.toLowerCase()) {
        if (move.piece === 'p') return move;
      }

      const pieceMap = { 'k': 'K', 'q': 'Q', 'r': 'R', 'b': 'B', 'n': 'N' };
      const pieceSymbol = pieceMap[move.piece];

      if (pieceSymbol) {
        if (input.toUpperCase() === pieceSymbol + move.to.toUpperCase()) {
          return move;
        }

        if (move.captured) {
          const withX = pieceSymbol + 'x' + move.to;
          const withoutX = pieceSymbol + move.to;

          if (input.toUpperCase() === withX.toUpperCase() ||
            input.toUpperCase() === withoutX.toUpperCase()) {
            return move;
          }
        }
      }

      if (move.piece === 'p' && move.captured) {
        const pawnCapture = move.from[0] + 'x' + move.to;
        const pawnCaptureNoX = move.from[0] + move.to;

        if (input.toLowerCase() === pawnCapture.toLowerCase() ||
          input.toLowerCase() === pawnCaptureNoX.toLowerCase()) {
          return move;
        }
      }
    }

    return null;
  }

  getSuggestion(input, possibleMoves) {
    const firstChar = input.charAt(0).toUpperCase();
    const pieceTypes = ['K', 'Q', 'R', 'B', 'N'];

    if (pieceTypes.includes(firstChar)) {
      const pieceMoves = possibleMoves.filter(m =>
        m.san.startsWith(firstChar)
      ).map(m => m.san);

      if (pieceMoves.length > 0) {
        return {
          piece: this.getPieceName(firstChar.toLowerCase()),
          validMoves: pieceMoves.slice(0, 5),
          reason: this.getInvalidReason(firstChar)
        };
      } else {
        return {
          piece: this.getPieceName(firstChar.toLowerCase()),
          validMoves: [],
          reason: `${this.getPieceName(firstChar.toLowerCase())} tidak bisa bergerak saat ini`
        };
      }
    }

    const allMoves = possibleMoves.map(m => m.san).slice(0, 8);
    return {
      piece: 'Unknown',
      validMoves: allMoves,
      reason: 'Notasi tidak dikenali'
    };
  }

  getInvalidReason(piece) {
    const reasons = {
      'B': 'Gajah hanya bisa bergerak diagonal',
      'R': 'Benteng hanya bisa bergerak lurus (horizontal/vertikal)',
      'N': 'Kuda bergerak bentuk L',
      'K': 'Raja hanya bisa bergerak 1 kotak',
      'Q': 'Ratu bisa diagonal atau lurus, tidak bisa loncat'
    };
    return reasons[piece] || 'Gerakan tidak valid';
  }

  getPieceName(pieceCode) {
    const names = {
      'p': 'Pion', 'n': 'Kuda', 'b': 'Gajah',
      'r': 'Benteng', 'q': 'Ratu', 'k': 'Raja',
      'K': 'Raja', 'Q': 'Ratu', 'R': 'Benteng',
      'B': 'Gajah', 'N': 'Kuda', 'P': 'Pion'
    };
    return names[pieceCode] || 'Piece';
  }

  // ==================== POSITION ANALYSIS ====================

  getMaterialCount() {
    const board = this.board();
    const material = {
      white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
    };

    for (let row of board) {
      for (let square of row) {
        if (square) {
          const color = square.color === 'w' ? 'white' : 'black';
          material[color][square.type]++;
        }
      }
    }

    return material;
  }

  getMaterialValue() {
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const material = this.getMaterialCount();

    let whiteValue = 0;
    let blackValue = 0;

    for (let piece in material.white) {
      whiteValue += material.white[piece] * pieceValues[piece];
    }

    for (let piece in material.black) {
      blackValue += material.black[piece] * pieceValues[piece];
    }

    return {
      white: whiteValue,
      black: blackValue,
      advantage: whiteValue - blackValue
    };
  }

  findKing(color) {
    const board = this.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === color) {
          return this.coordsToSquare(row, col);
        }
      }
    }
    return null;
  }

  // ==================== RAY CASTING ====================

  getRayDirections(pieceType) {
    const directions = {
      'r': [[0, 1], [0, -1], [1, 0], [-1, 0]], // Rook: horizontal, vertical
      'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]], // Bishop: diagonals
      'q': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], // Queen: all
      'k': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], // King: all (1 square)
      'n': [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]], // Knight: L-shape
      'p': [] // Pawn: special case
    };
    return directions[pieceType] || [];
  }

  castRay(startRow, startCol, dirRow, dirCol, maxDistance = 8) {
    const squares = [];
    let row = startRow + dirRow;
    let col = startCol + dirCol;
    let distance = 0;

    while (this.isValidSquare(row, col) && distance < maxDistance) {
      squares.push({ row, col, square: this.coordsToSquare(row, col) });

      const piece = this.board()[row][col];
      if (piece) {
        break; // Ray stops at first piece
      }

      row += dirRow;
      col += dirCol;
      distance++;
    }

    return squares;
  }

  getAttackedSquaresByPiece(square, piece) {
    const coords = this.squareToCoords(square);
    const attacked = [];

    if (piece.type === 'p') {
      // Pawn attacks diagonally
      const direction = piece.color === 'w' ? -1 : 1;
      const attackSquares = [
        this.coordsToSquare(coords.row + direction, coords.col - 1),
        this.coordsToSquare(coords.row + direction, coords.col + 1)
      ];
      return attackSquares.filter(s => s !== null);
    }

    if (piece.type === 'n') {
      // Knight: L-shape jumps
      const directions = this.getRayDirections('n');
      for (const [dr, dc] of directions) {
        const sq = this.coordsToSquare(coords.row + dr, coords.col + dc);
        if (sq) attacked.push(sq);
      }
      return attacked;
    }

    if (piece.type === 'k') {
      // King: 1 square in all directions
      const directions = this.getRayDirections('k');
      for (const [dr, dc] of directions) {
        const sq = this.coordsToSquare(coords.row + dr, coords.col + dc);
        if (sq) attacked.push(sq);
      }
      return attacked;
    }

    // Sliding pieces (rook, bishop, queen)
    const directions = this.getRayDirections(piece.type);
    for (const [dr, dc] of directions) {
      const ray = this.castRay(coords.row, coords.col, dr, dc);
      for (const raySquare of ray) {
        attacked.push(raySquare.square);
      }
    }

    return attacked;
  }

  isSquareAttackedBy(square, attackerColor) {
    const board = this.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === attackerColor) {
          const fromSquare = this.coordsToSquare(row, col);
          const attackedSquares = this.getAttackedSquaresByPiece(fromSquare, piece);
          if (attackedSquares.includes(square)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  getAttackersOfSquare(square, attackerColor) {
    const board = this.board();
    const attackers = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === attackerColor) {
          const fromSquare = this.coordsToSquare(row, col);
          const attackedSquares = this.getAttackedSquaresByPiece(fromSquare, piece);
          if (attackedSquares.includes(square)) {
            attackers.push({
              square: fromSquare,
              piece: piece.type,
              color: piece.color
            });
          }
        }
      }
    }

    return attackers;
  }

  // ==================== TACTICAL DETECTION ====================

  detectTactic(move, beforeFen) {
    const beforeGame = new Chess(beforeFen);

    const tactics = {
      isCheck: this.isCheck(),
      isCheckmate: this.isCheckmate(),
      isCapture: !!move.captured,
      isCastling: move.flags.includes('k') || move.flags.includes('q'),
      isEnPassant: move.flags.includes('e'),
      isPromotion: move.flags.includes('p'),
      capturedPiece: move.captured,
      promotedTo: move.promotion
    };

    tactics.isFork = this.detectFork(move);
    tactics.isPin = this.detectPin(move, beforeGame);
    tactics.isSkewer = this.detectSkewer(move, beforeGame);
    tactics.isDiscoveredAttack = this.detectDiscoveredAttack(move, beforeGame);
    tactics.isSacrifice = this.detectSacrifice(move);
    tactics.isMatingThreat = this.detectMatingThreat();
    tactics.isDoubleAttack = this.detectDoubleAttack(move);

    return tactics;
  }

  detectFork(move) {
    const targetSquare = move.to;
    const piece = this.get(targetSquare);

    if (!piece) return false;

    const attackedSquares = this.getAttackedSquaresByPiece(targetSquare, piece);
    const enemyColor = piece.color === 'w' ? 'b' : 'w';

    let valuableTargets = 0;
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

    for (const sq of attackedSquares) {
      const target = this.get(sq);
      if (target && target.color === enemyColor) {
        if (pieceValues[target.type] >= pieceValues[piece.type]) {
          valuableTargets++;
        }
      }
    }

    return valuableTargets >= 2;
  }

  detectPin(move, beforeGame) {
    // Pin detection: piece cannot move because it would expose a more valuable piece
    const movedPiece = this.get(move.to);
    if (!movedPiece) return false;

    const enemyColor = movedPiece.color === 'w' ? 'b' : 'w';
    const myColor = movedPiece.color;

    // Check if the move pins an enemy piece
    const coords = this.squareToCoords(move.to);
    const directions = this.getRayDirections(movedPiece.type);

    for (const [dr, dc] of directions) {
      const ray = this.castRay(coords.row, coords.col, dr, dc);

      if (ray.length < 2) continue;

      // Check if there's an enemy piece followed by a more valuable piece
      let firstPiece = null;
      let secondPiece = null;

      for (const raySquare of ray) {
        const piece = this.get(raySquare.square);
        if (piece) {
          if (!firstPiece) {
            firstPiece = { square: raySquare.square, piece };
          } else if (!secondPiece) {
            secondPiece = { square: raySquare.square, piece };
            break;
          }
        }
      }

      if (firstPiece && secondPiece) {
        // Check if it's a pin: enemy piece in front, valuable piece behind
        if (firstPiece.piece.color === enemyColor &&
          secondPiece.piece.color === enemyColor &&
          this.getPieceValue(secondPiece.piece.type) > this.getPieceValue(firstPiece.piece.type)) {
          return true;
        }
      }
    }

    return false;
  }

  detectSkewer(move, beforeGame) {
    // Skewer: attack on valuable piece, forcing it to move and expose less valuable piece
    const movedPiece = this.get(move.to);
    if (!movedPiece) return false;

    const enemyColor = movedPiece.color === 'w' ? 'b' : 'w';
    const coords = this.squareToCoords(move.to);
    const directions = this.getRayDirections(movedPiece.type);

    for (const [dr, dc] of directions) {
      const ray = this.castRay(coords.row, coords.col, dr, dc);

      if (ray.length < 2) continue;

      let firstPiece = null;
      let secondPiece = null;

      for (const raySquare of ray) {
        const piece = this.get(raySquare.square);
        if (piece) {
          if (!firstPiece) {
            firstPiece = { square: raySquare.square, piece };
          } else if (!secondPiece) {
            secondPiece = { square: raySquare.square, piece };
            break;
          }
        }
      }

      if (firstPiece && secondPiece) {
        // Skewer: valuable piece in front, less valuable behind
        if (firstPiece.piece.color === enemyColor &&
          secondPiece.piece.color === enemyColor &&
          this.getPieceValue(firstPiece.piece.type) > this.getPieceValue(secondPiece.piece.type)) {
          return true;
        }
      }
    }

    return false;
  }

  detectDiscoveredAttack(move, beforeGame) {
    // Discovered attack: moving a piece reveals an attack from another piece
    const fromCoords = this.squareToCoords(move.from);
    const board = this.board();
    const myColor = this.turn() === 'w' ? 'b' : 'w'; // Opposite because turn has switched
    const enemyColor = this.turn();

    // Check all sliding pieces of my color
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === myColor && (piece.type === 'r' || piece.type === 'b' || piece.type === 'q')) {
          const pieceSquare = this.coordsToSquare(row, col);
          const directions = this.getRayDirections(piece.type);

          for (const [dr, dc] of directions) {
            const ray = this.castRay(row, col, dr, dc);

            // Check if the ray passes through where the piece moved from
            let passedThroughFrom = false;
            let foundEnemyPiece = false;

            for (const raySquare of ray) {
              if (raySquare.square === move.from) {
                passedThroughFrom = true;
              }

              const targetPiece = this.get(raySquare.square);
              if (targetPiece && targetPiece.color === enemyColor && passedThroughFrom) {
                foundEnemyPiece = true;
                break;
              }
            }

            if (passedThroughFrom && foundEnemyPiece) {
              // Check if this attack didn't exist before the move
              const beforeAttackedSquares = beforeGame.getAttackedSquaresByPiece(pieceSquare, piece);
              const afterAttackedSquares = this.getAttackedSquaresByPiece(pieceSquare, piece);

              // If there are new attacked squares, it's a discovered attack
              for (const sq of afterAttackedSquares) {
                const p = this.get(sq);
                if (p && p.color === enemyColor && !beforeAttackedSquares.includes(sq)) {
                  return true;
                }
              }
            }
          }
        }
      }
    }

    return false;
  }

  detectDoubleAttack(move) {
    // Double attack: one piece attacks two or more enemy pieces simultaneously
    const piece = this.get(move.to);
    if (!piece) return false;

    const attackedSquares = this.getAttackedSquaresByPiece(move.to, piece);
    const enemyColor = piece.color === 'w' ? 'b' : 'w';

    let attackCount = 0;
    for (const sq of attackedSquares) {
      const target = this.get(sq);
      if (target && target.color === enemyColor) {
        attackCount++;
      }
    }

    return attackCount >= 2;
  }

  detectSacrifice(move) {
    if (!move.captured) return false;

    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const givenValue = pieceValues[move.piece] || 0;
    const takenValue = pieceValues[move.captured] || 0;

    return givenValue > takenValue && givenValue >= 3;
  }

  detectMatingThreat() {
    // Check if any of our moves results in checkmate
    const moves = this.moves({ verbose: true });
    const currentFen = this.fen();

    for (const testMove of moves) {
      const testGame = new Chess(currentFen);
      testGame.move(testMove.san);
      if (testGame.isCheckmate()) {
        return true;
      }
    }

    return false;
  }

  getPieceValue(pieceType) {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    return values[pieceType] || 0;
  }

  // ==================== POSITION EVALUATION ====================

  evaluatePosition() {
    let score = 0;

    // Material
    const material = this.getMaterialValue();
    score += material.advantage;

    // Piece-square tables
    score += this.evaluatePieceSquareTables();

    // Center control
    score += this.evaluateCenterControl();

    // King safety
    score += this.evaluateKingSafety();

    // Pawn structure
    score += this.evaluatePawnStructure();

    // Piece mobility
    score += this.evaluateMobility();

    // Piece coordination
    score += this.evaluatePieceCoordination();

    return {
      score: score,
      material: material,
      evaluation: this.getEvaluationText(score)
    };
  }

  evaluatePieceSquareTables() {
    const board = this.board();
    let score = 0;

    // piece-square tables (positive for white control)
    const pawnTable = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    const knightTable = [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ];

    const bishopTable = [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        const multiplier = piece.color === 'w' ? 1 : -1;
        const pieceRow = piece.color === 'w' ? row : 7 - row;

        if (piece.type === 'p') {
          score += pawnTable[pieceRow][col] * 0.01 * multiplier;
        } else if (piece.type === 'n') {
          score += knightTable[pieceRow][col] * 0.01 * multiplier;
        } else if (piece.type === 'b') {
          score += bishopTable[pieceRow][col] * 0.01 * multiplier;
        }
      }
    }

    return score;
  }

  evaluateCenterControl() {
    const centerSquares = ['e4', 'd4', 'e5', 'd5'];
    const extendedCenter = ['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'];
    let score = 0;

    for (const square of centerSquares) {
      const piece = this.get(square);
      if (piece) {
        score += piece.color === 'w' ? 0.3 : -0.3;
      }

      // Control even without piece
      const whiteAttackers = this.getAttackersOfSquare(square, 'w');
      const blackAttackers = this.getAttackersOfSquare(square, 'b');
      score += (whiteAttackers.length - blackAttackers.length) * 0.1;
    }

    for (const square of extendedCenter) {
      const piece = this.get(square);
      if (piece) {
        score += piece.color === 'w' ? 0.1 : -0.1;
      }
    }

    return score;
  }

  evaluateKingSafety() {
    let score = 0;

    const whiteKing = this.findKing('w');
    const blackKing = this.findKing('b');

    if (whiteKing) {
      const whiteKingCoords = this.squareToCoords(whiteKing);
      const whiteAttackers = this.getAttackersOfSquare(whiteKing, 'b');
      const whitePawnShield = this.evaluatePawnShield(whiteKingCoords, 'w');

      score -= whiteAttackers.length * 0.5;
      score += whitePawnShield * 0.3;
    }

    if (blackKing) {
      const blackKingCoords = this.squareToCoords(blackKing);
      const blackAttackers = this.getAttackersOfSquare(blackKing, 'w');
      const blackPawnShield = this.evaluatePawnShield(blackKingCoords, 'b');

      score += blackAttackers.length * 0.5;
      score -= blackPawnShield * 0.3;
    }

    return score;
  }

  evaluatePawnShield(kingCoords, color) {
    const direction = color === 'w' ? -1 : 1;
    let shieldCount = 0;

    const shieldSquares = [
      this.coordsToSquare(kingCoords.row + direction, kingCoords.col - 1),
      this.coordsToSquare(kingCoords.row + direction, kingCoords.col),
      this.coordsToSquare(kingCoords.row + direction, kingCoords.col + 1)
    ];

    for (const square of shieldSquares) {
      if (square) {
        const piece = this.get(square);
        if (piece && piece.type === 'p' && piece.color === color) {
          shieldCount++;
        }
      }
    }

    return shieldCount;
  }

  evaluatePawnStructure() {
    let score = 0;
    const board = this.board();

    // Check for doubled pawns
    const whitePawnFiles = new Array(8).fill(0);
    const blackPawnFiles = new Array(8).fill(0);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'p') {
          if (piece.color === 'w') {
            whitePawnFiles[col]++;
          } else {
            blackPawnFiles[col]++;
          }
        }
      }
    }

    // Penalty for doubled pawns
    for (let i = 0; i < 8; i++) {
      if (whitePawnFiles[i] > 1) score -= 0.5 * (whitePawnFiles[i] - 1);
      if (blackPawnFiles[i] > 1) score += 0.5 * (blackPawnFiles[i] - 1);
    }

    // Check for isolated pawns
    for (let col = 0; col < 8; col++) {
      const leftFile = col > 0 ? whitePawnFiles[col - 1] : 0;
      const rightFile = col < 7 ? whitePawnFiles[col + 1] : 0;

      if (whitePawnFiles[col] > 0 && leftFile === 0 && rightFile === 0) {
        score -= 0.3;
      }
    }

    for (let col = 0; col < 8; col++) {
      const leftFile = col > 0 ? blackPawnFiles[col - 1] : 0;
      const rightFile = col < 7 ? blackPawnFiles[col + 1] : 0;

      if (blackPawnFiles[col] > 0 && leftFile === 0 && rightFile === 0) {
        score += 0.3;
      }
    }

    return score;
  }

  evaluateMobility() {
    const currentTurn = this.turn();

    // Count legal moves for current position
    const currentMoves = this.moves().length;

    // Simulate opponent's mobility
    const currentFen = this.fen();
    const fenParts = currentFen.split(' ');
    fenParts[1] = currentTurn === 'w' ? 'b' : 'w'; // Switch turn
    const oppositeFen = fenParts.join(' ');

    let opponentMoves = 0;
    try {
      const testGame = new Chess(oppositeFen);
      opponentMoves = testGame.moves().length;
    } catch (e) {
      opponentMoves = 0;
    }

    const mobilityDiff = currentMoves - opponentMoves;
    const score = mobilityDiff * 0.05;

    return currentTurn === 'w' ? score : -score;
  }

  evaluatePieceCoordination() {
    let score = 0;
    const board = this.board();

    // Pieces are better when they protect each other
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        const square = this.coordsToSquare(row, col);
        const defenders = this.getAttackersOfSquare(square, piece.color);

        const multiplier = piece.color === 'w' ? 1 : -1;
        score += defenders.length * 0.05 * multiplier;
      }
    }

    return score;
  }

  getEvaluationText(score) {
    if (score > 3) return 'Putih sangat unggul';
    if (score > 1) return 'Putih sedikit lebih baik';
    if (score > -1) return 'Posisi seimbang';
    if (score > -3) return 'Hitam sedikit lebih baik';
    return 'Hitam sangat unggul';
  }
}

export { Chess };
