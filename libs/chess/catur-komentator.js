class ChessCommentator {
  constructor() {
    this.moveCount = 0;
    this.gamePhase = 'opening'; // opening, middlegame, endgame
    this.lastEvaluation = 0;
  }

  commentateMove(game, move, player, beforeFen) {
    this.moveCount++;
    this.updateGamePhase(game);
 
    const tactics = game.detectTactic(move, beforeFen);
    const evaluation = game.evaluatePosition();
    const material = game.getMaterialValue();
 
    const evalSwing = Math.abs(evaluation.score - this.lastEvaluation);
    this.lastEvaluation = evaluation.score;
    
    const isBrilliant = this.isBrilliantMove(tactics, evalSwing, evaluation, player);
    const isBlunder = this.isBlunder(tactics, evalSwing, evaluation, player);
    const isGreat = this.isGreatMove(tactics, evalSwing);
    const isMistake = this.isMistake(evalSwing);

    return this.generateFullCommentary(move, tactics, {
      isBrilliant,
      isBlunder,
      isGreat,
      isMistake,
      evaluation,
      material,
      player
    });
  }

  updateGamePhase(game) {
    const material = game.getMaterialCount();
    const totalPieces = 
      material.white.q + material.white.r + material.white.b + material.white.n +
      material.black.q + material.black.r + material.black.b + material.black.n;

    if (this.moveCount < 10) {
      this.gamePhase = 'opening';
    } else if (totalPieces <= 6) {
      this.gamePhase = 'endgame';
    } else {
      this.gamePhase = 'middlegame';
    }
  }

  isBrilliantMove(tactics, evalSwing, evaluation, player) {
    if (tactics.isSacrifice && evalSwing > 2) return true;    
    if (tactics.isFork && tactics.isCheck) return true;
    if (tactics.isDiscoveredAttack && tactics.isMatingThreat) return true;
    if (tactics.isCheckmate) return true;
    
    const tacticCount = [
      tactics.isFork,
      tactics.isPin,
      tactics.isSkewer,
      tactics.isDiscoveredAttack,
      tactics.isCheck
    ].filter(Boolean).length;
    
    if (tacticCount >= 2 && evalSwing > 1.5) return true;
    
    return false;
  }

  isBlunder(tactics, evalSwing, evaluation, player) {
    const playerColor = player === 'player' ? 'w' : 'b';
    const colorMultiplier = playerColor === 'w' ? 1 : -1;
    
    if (evalSwing > 3 && (evaluation.score * colorMultiplier) < this.lastEvaluation * colorMultiplier) {
      return true;
    }
    
    if (tactics.isSacrifice && evalSwing < 0.5) {
      return true;
    }
    
    return false;
  }

  isGreatMove(tactics, evalSwing) {
    return (tactics.isFork || tactics.isPin || tactics.isDiscoveredAttack) && evalSwing > 1;
  }

  isMistake(evalSwing) {
    return evalSwing > 1.5 && evalSwing < 3;
  }

  generateFullCommentary(move, tactics, analysis) {
    const { isBrilliant, isBlunder, isGreat, isMistake, evaluation, material, player } = analysis;

    if (tactics.isCheckmate) {
      return {
        emoji: '🎯',
        title: 'CHECKMATE!!!',
        description: `${move.san} - Skakmat yang menentukan! Game over!`,
        evaluation: '±∞',
        moveQuality: 'checkmate'
      };
    }

    if (isBrilliant) {
      return this.generateBrilliantCommentary(move, tactics, evaluation);
    }
    
    if (isBlunder) {
      return this.generateBlunderCommentary(move, tactics, evaluation);
    }

    if (isGreat) {
      return this.generateGreatMoveCommentary(move, tactics, evaluation);
    }

    if (isMistake) {
      return this.generateMistakeCommentary(move, tactics, evaluation);
    }

    if (tactics.isCastling) {
      return this.generateCastlingCommentary(move);
    }

    if (tactics.isPromotion) {
      return this.generatePromotionCommentary(move, tactics);
    }

    if (tactics.isFork) {
      return this.generateForkCommentary(move, evaluation);
    }

    if (tactics.isPin) {
      return this.generatePinCommentary(move, evaluation);
    }

    if (tactics.isDiscoveredAttack) {
      return this.generateDiscoveredAttackCommentary(move, evaluation);
    }

    if (tactics.isEnPassant) {
      return this.generateEnPassantCommentary(move);
    }

    if (tactics.isCheck) {
      return this.generateCheckCommentary(move, evaluation);
    }

    if (tactics.isCapture) {
      return this.generateCaptureCommentary(move, tactics, evaluation);
    }

    return this.generateRegularCommentary(move, evaluation, material);
  }

  generateBrilliantCommentary(move, tactics, evaluation) {
    const reasons = [];
    
    if (tactics.isSacrifice) {
      const piece = this.getPieceName(move.piece);
      reasons.push(`Pengorbanan ${piece} yang cemerlang!`);
    }
    
    if (tactics.isFork) {
      reasons.push('Garpu ganda yang devastating!');
    }
    
    if (tactics.isDiscoveredAttack) {
      reasons.push('Serangan tersembunyi terungkap dengan sempurna!');
    }
    
    if (tactics.isMatingThreat) {
      reasons.push('Mengancam checkmate!');
    }

    const description = reasons.length > 0 
      ? `${move.san} - ${reasons.join(' ')}`
      : `${move.san} - Gerakan luar biasa yang mengubah permainan!`;

    return {
      emoji: '💎',
      title: '✨ BRILLIANT MOVE! ✨',
      description: description,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'brilliant'
    };
  }

  generateBlunderCommentary(move, tactics, evaluation) {
    const warnings = [];
    
    if (tactics.isSacrifice) {
      const piece = this.getPieceName(move.piece);
      warnings.push(`Kehilangan ${piece} tanpa kompensasi`);
    }
    
    if (evaluation.score < -3) {
      warnings.push('Posisi menjadi sangat buruk');
    }

    const description = warnings.length > 0
      ? `${move.san} - ⚠️ ${warnings.join(', ')}`
      : `${move.san} - Gerakan ini merugikan posisi Anda`;

    return {
      emoji: '⚠️',
      title: 'BLUNDER!',
      description: description,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'blunder'
    };
  }

  generateGreatMoveCommentary(move, tactics, evaluation) {
    let tacticName = '';
    
    if (tactics.isFork) tacticName = 'Fork attack';
    else if (tactics.isPin) tacticName = 'Pin';
    else if (tactics.isDiscoveredAttack) tacticName = 'Discovered attack';
    else tacticName = 'Tactical strike';

    return {
      emoji: '🔥',
      title: `Great Move! ${tacticName}!`,
      description: `${move.san} - ${tacticName} yang efektif! Posisi membaik.`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'great'
    };
  }

  generateMistakeCommentary(move, tactics, evaluation) {
    return {
      emoji: '😕',
      title: 'Inaccuracy',
      description: `${move.san} - Bukan gerakan terbaik, tapi masih bisa dilanjutkan.`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'mistake'
    };
  }

  generateCastlingCommentary(move) {
    const side = move.flags.includes('k') ? 'kingside' : 'queenside';
    const sideText = side === 'kingside' ? 'pendek (kingside)' : 'panjang (queenside)';
    
    return {
      emoji: '🏰',
      title: 'Castling!',
      description: `${move.san} - Rokade ${sideText}! Raja diamankan, benteng diaktifkan.`,
      evaluation: '≈',
      moveQuality: 'good'
    };
  }

  generatePromotionCommentary(move, tactics) {
    const promoted = this.getPieceName(tactics.promotedTo);
    
    return {
      emoji: '👑',
      title: 'PROMOTION!',
      description: `${move.san} - Pion dipromosikan menjadi ${promoted}! Kekuatan bertambah drastis!`,
      evaluation: '+',
      moveQuality: 'good'
    };
  }

  generateForkCommentary(move, evaluation) {
    return {
      emoji: '🍴',
      title: 'Fork Attack!',
      description: `${move.san} - Serangan garpu! Mengancam beberapa pieces sekaligus!`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'good'
    };
  }

  generatePinCommentary(move, evaluation) {
    return {
      emoji: '📌',
      title: 'Pin!',
      description: `${move.san} - Pin taktis! Lawan terjebak tidak bisa bergerak bebas!`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'good'
    };
  }

  generateDiscoveredAttackCommentary(move, evaluation) {
    return {
      emoji: '🎭',
      title: 'Discovered Attack!',
      description: `${move.san} - Serangan tersembunyi terungkap! Double trouble untuk lawan!`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'good'
    };
  }

  generateEnPassantCommentary(move) {
    return {
      emoji: '🎯',
      title: 'En Passant!',
      description: `${move.san} - En passant yang cantik! Gerakan spesial menangkap pion lawan!`,
      evaluation: '≈',
      moveQuality: 'good'
    };
  }

  generateCheckCommentary(move, evaluation) {
    return {
      emoji: '⚔️',
      title: 'Check!',
      description: `${move.san} - Skak! Raja lawan dalam bahaya!`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'good'
    };
  }

  generateCaptureCommentary(move, tactics, evaluation) {
    const captured = this.getPieceName(tactics.capturedPiece);
    const attacker = this.getPieceName(move.piece);
    
    const phrases = [
      `${attacker} strikes! ${captured} eliminated!`,
      `${attacker} captures ${captured}!`,
      `${captured} falls to ${attacker}!`,
      `Clean capture! ${attacker} takes ${captured}!`
    ];
    
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    return {
      emoji: '⚡',
      title: phrase,
      description: `${move.san} - ${attacker} memakan ${captured}!`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'normal'
    };
  }

  generateRegularCommentary(move, evaluation, material) {
    if (this.gamePhase === 'opening') {
      return this.generateOpeningCommentary(move, evaluation);
    } else if (this.gamePhase === 'endgame') {
      return this.generateEndgameCommentary(move, evaluation, material);
    } else {
      return this.generateMiddlegameCommentary(move, evaluation);
    }
  }

  generateOpeningCommentary(move, evaluation) {
    const phrases = [
      { emoji: '📖', title: 'Opening Development', description: 'Mengembangkan posisi dengan prinsip opening yang solid.' },
      { emoji: '🎯', title: 'Center Control', description: 'Menguasai pusat papan, langkah penting di pembukaan.' },
      { emoji: '⭐', title: 'Classical Opening', description: 'Mengikuti teori pembukaan klasik.' },
      { emoji: '🏰', title: 'King Safety', description: 'Mempersiapkan keamanan raja.' },
      { emoji: '♞', title: 'Piece Development', description: 'Mengaktifkan pieces dengan baik.' }
    ];
    
    const chosen = phrases[Math.floor(Math.random() * phrases.length)];
    
    return {
      emoji: chosen.emoji,
      title: chosen.title,
      description: `${move.san} - ${chosen.description}`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'normal'
    };
  }

  generateMiddlegameCommentary(move, evaluation) {
    const phrases = [
      { emoji: '♟️', title: 'Solid Move', description: 'Gerakan yang aman dan terukur.' },
      { emoji: '🎯', title: 'Positional Play', description: 'Memperbaiki posisi secara strategis.' },
      { emoji: '⚙️', title: 'Strategic Move', description: 'Langkah strategis untuk jangka panjang.' },
      { emoji: '🛡️', title: 'Consolidation', description: 'Mengkonsolidasikan posisi.' },
      { emoji: '🎪', title: 'Maneuvering', description: 'Piece manuver mencari posisi terbaik.' }
    ];
    
    const chosen = phrases[Math.floor(Math.random() * phrases.length)];
    
    return {
      emoji: chosen.emoji,
      title: chosen.title,
      description: `${move.san} - ${chosen.description}`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'normal'
    };
  }

  generateEndgameCommentary(move, evaluation, material) {
    const advantage = material.advantage;
    
    const phrases = [
      { emoji: '👑', title: 'Endgame Technique', description: 'Teknik endgame yang tepat.' },
      { emoji: '🎯', title: 'King Activity', description: 'Raja aktif di endgame, kunci kemenangan.' },
      { emoji: '♟️', title: 'Pawn Push', description: 'Mendorong pion menuju promosi.' },
      { emoji: '⚔️', title: 'Active Play', description: 'Bermain aktif mencari kemenangan.' },
      { emoji: '🛡️', title: 'Defensive Precision', description: 'Bertahan dengan presisi tinggi.' }
    ];
    
    const chosen = phrases[Math.floor(Math.random() * phrases.length)];
    
    return {
      emoji: chosen.emoji,
      title: chosen.title,
      description: `${move.san} - ${chosen.description}`,
      evaluation: this.formatEvaluation(evaluation.score),
      moveQuality: 'normal'
    };
  }

  formatEvaluation(score) {
    if (score > 5) return '+−';
    if (score > 2) return '±';
    if (score > 0.5) return '+/=';
    if (score > -0.5) return '=';
    if (score > -2) return '=/−';
    if (score > -5) return '∓';
    return '−+';
  }

  getPieceName(pieceCode) {
    const names = {
      'p': 'Pion', 'n': 'Kuda', 'b': 'Gajah', 
      'r': 'Benteng', 'q': 'Ratu', 'k': 'Raja',
      'P': 'Pion', 'N': 'Kuda', 'B': 'Gajah',
      'R': 'Benteng', 'Q': 'Ratu', 'K': 'Raja'
    };
    return names[pieceCode] || 'Piece';
  }

  getHint(game) {
    const hints = [
      '💡 Perhatikan pusat papan catur',
      '💡 Jangan lupa lindungi raja Anda',
      '💡 Kembangkan pieces sebelum menyerang',
      '💡 Cari peluang untuk fork atau pin',
      '💡 Kontrol diagonal dan file penting',
      '💡 Rooks di open file sangat kuat',
      '💡 Knights di outpost sangat efektif',
      '💡 Bishops pair sangat kuat di endgame'
    ];

    if (Math.random() < 0.3) {
      return hints[Math.floor(Math.random() * hints.length)];
    }

    return null;
  }
}

export { ChessCommentator };