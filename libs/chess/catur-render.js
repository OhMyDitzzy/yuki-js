import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

class ChessRenderer {
  constructor(options = {}) {
    this.squareSize = options.squareSize || 80;
    this.boardSize = this.squareSize * 8;
    this.lightSquareColor = options.lightSquareColor || '#F0D9B5';
    this.darkSquareColor = options.darkSquareColor || '#B58863';
    this.borderSize = options.borderSize || 30;
    this.fontSize = options.fontSize || 16;
    this.coordinateColor = options.coordinateColor || '#000000';
    this.assetsPath = options.assetsPath || './assets/chess';
    this.pieceImages = {};
  }

  async loadPieceImages() {
    const pieces = {
      'wK': 'white-king.png',
      'wQ': 'white-queen.png',
      'wR': 'white-rook.png',
      'wB': 'white-bishop.png',
      'wN': 'white-knight.png',
      'wP': 'white-pawn.png',
      'bK': 'black-king.png',
      'bQ': 'black-queen.png',
      'bR': 'black-rook.png',
      'bB': 'black-bishop.png',
      'bN': 'black-knight.png',
      'bP': 'black-pawn.png'
    };

    for (const [key, filename] of Object.entries(pieces)) {
      const imagePath = path.join(this.assetsPath, filename);

      if (fs.existsSync(imagePath)) {
        try {
          this.pieceImages[key] = await loadImage(imagePath);
        } catch (error) {
          console.warn(`Gagal memuat gambar: ${imagePath}, akan menggunakan text sebagai pengganti`);
          this.pieceImages[key] = null;
        }
      } else {
        this.pieceImages[key] = null;
      }
    }
  }

  getPieceSymbol(piece) {
    const symbols = {
      'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
      'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
    };
    
    return symbols[piece.color + piece.type.toUpperCase()] || '';
  }

  drawBoard(ctx) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * this.squareSize + this.borderSize;
        const y = row * this.squareSize + this.borderSize;
    
        const isLightSquare = (row + col) % 2 === 0;
        ctx.fillStyle = isLightSquare ? this.lightSquareColor : this.darkSquareColor;
        
        ctx.fillRect(x, y, this.squareSize, this.squareSize);
      }
    }

    this.drawCoordinates(ctx);
  }

  drawCoordinates(ctx) {
    ctx.fillStyle = this.coordinateColor;
    ctx.font = `bold ${this.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let i = 0; i < 8; i++) {
      const x = i * this.squareSize + this.borderSize + this.squareSize / 2;
      const y = this.boardSize + this.borderSize + this.borderSize / 2;
      ctx.fillText(files[i], x, y);
    }

    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      const x = this.borderSize / 2;
      const y = i * this.squareSize + this.borderSize + this.squareSize / 2;
      ctx.fillText(ranks[i], x, y);
    }
  }

  async drawPieces(ctx, board) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        
        if (piece) {
          const x = col * this.squareSize + this.borderSize;
          const y = row * this.squareSize + this.borderSize;
          
          const pieceKey = piece.color + piece.type.toUpperCase();
          const pieceImage = this.pieceImages[pieceKey];
          
          if (pieceImage) {
            const padding = this.squareSize * 0.1;
            ctx.drawImage(
              pieceImage,
              x + padding,
              y + padding,
              this.squareSize - padding * 2,
              this.squareSize - padding * 2
            );
          } else {
            const symbol = this.getPieceSymbol(piece);
            ctx.font = `${this.squareSize * 0.7}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
  
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillStyle = piece.color === 'w' ? '#FFFFFF' : '#000000';
            ctx.fillText(
              symbol,
              x + this.squareSize / 2,
              y + this.squareSize / 2
            );
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
        }
      }
    }
  }

  drawLastMove(ctx, game) {
    const history = game.history({ verbose: true });
    
    if (history.length > 0) {
      const lastMove = history[history.length - 1];
      
      this.highlightSquare(ctx, lastMove.from, 'rgba(255, 255, 0, 0.3)');
      this.highlightSquare(ctx, lastMove.to, 'rgba(255, 255, 0, 0.3)');
    }
  }

  drawCheckHighlight(ctx, game) {
    if (game.isCheck()) {
      const board = game.board();
      const turn = game.turn();
      
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          
          if (piece && piece.type === 'k' && piece.color === turn) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
            const square = files[col] + ranks[row];
            
            this.highlightSquare(ctx, square, 'rgba(255, 0, 0, 0.5)');
            break;
          }
        }
      }
    }
  }

  highlightSquare(ctx, square, color) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    const col = files.indexOf(square[0]);
    const row = ranks.indexOf(square[1]);
    
    if (col !== -1 && row !== -1) {
      const x = col * this.squareSize + this.borderSize;
      const y = row * this.squareSize + this.borderSize;
      
      ctx.fillStyle = color;
      ctx.fillRect(x, y, this.squareSize, this.squareSize);
    }
  }

  async renderBoard(game, options = {}) {
    const showLastMove = options.showLastMove !== false;
    const showCheck = options.showCheck !== false;

    if (Object.keys(this.pieceImages).length === 0) {
      await this.loadPieceImages();
    }

    const canvasWidth = this.boardSize + this.borderSize * 2;
    const canvasHeight = this.boardSize + this.borderSize * 2;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    this.drawBoard(ctx);

    if (showLastMove) {
      this.drawLastMove(ctx, game);
    }

    if (showCheck) {
      this.drawCheckHighlight(ctx, game);
    }

    const board = game.board();
    await this.drawPieces(ctx, board);

    this.drawGameInfo(ctx, game, canvasWidth, canvasHeight);

    return canvas.toBuffer('image/png');
  }

  drawGameInfo(ctx, game, canvasWidth, canvasHeight) {
    const turn = game.turn() === 'w' ? 'Putih' : 'Hitam';
    let status = `Giliran: ${turn}`;
    
    if (game.isCheckmate()) {
      status = 'Checkmate!';
    } else if (game.isStalemate()) {
      status = 'Stalemate!';
    } else if (game.isDraw()) {
      status = 'Draw!';
    } else if (game.isCheck()) {
      status = `${turn} - Skak!`;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(this.borderSize, 5, canvasWidth - this.borderSize * 2, 20);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(status, canvasWidth / 2, 15);
  }

  async saveBoardImage(game, outputPath, options = {}) {
    const buffer = await this.renderBoard(game, options);
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }
}

export { ChessRenderer };