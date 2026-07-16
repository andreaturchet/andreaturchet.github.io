(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const context = canvas.getContext("2d", { alpha: false });
  const shell = document.querySelector(".game-shell");
  const hud = document.querySelector(".hud");
  const scoreElement = document.getElementById("score");
  const startScreen = document.getElementById("startScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const finalScoreElement = document.getElementById("finalScore");
  const bestScoreElement = document.getElementById("bestScore");
  const resultMessage = document.getElementById("resultMessage");
  const status = document.getElementById("status");

  const portrait = new Image();
  portrait.decoding = "async";
  portrait.src = "andrea-player.png";

  const STORAGE_KEY = "rapRoadNaspiBest";
  const GRAVITY = 1580;
  const FLAP_FORCE = -520;
  const BASE_SPEED = 188;
  const SPAWN_TIME = 1.48;
  const PLAYER_SIZE = 62;
  const PLAYER_SPRITE_HEIGHT = PLAYER_SIZE * 1.48;
  const PLAYER_SPRITE_RATIO = 548 / 720;
  const PLAYER_HITBOX_HALF_WIDTH = PLAYER_SPRITE_HEIGHT * PLAYER_SPRITE_RATIO * 0.44;
  const PLAYER_HITBOX_HALF_HEIGHT = PLAYER_SPRITE_HEIGHT * 0.47;

  const offers = [
    {
      company: "DYNAMIC S.R.L.",
      role: "Junior AI Wizard",
      detail: "5 anni di esperienza",
      salary: "€600 + visibilità",
      color: "#ff6a48"
    },
    {
      company: "BIG DATA & FIGLI",
      role: "Data Scientist",
      detail: "Entry level · PhD",
      salary: "RAL misteriosa",
      color: "#73c6ff"
    },
    {
      company: "REMOTE-ish",
      role: "Prompt Engineer",
      detail: "Full remote*",
      salary: "*3 giorni in sede",
      color: "#c2ef67"
    },
    {
      company: "UNICORN LABS",
      role: "ML Engineer",
      detail: "8 framework richiesti",
      salary: "Stage curricolare",
      color: "#d5a7ff"
    },
    {
      company: "ROCKSTAR CORP.",
      role: "Ninja Developer",
      detail: "Ambiente dinamico",
      salary: "Pizza il venerdì",
      color: "#ffd45f"
    }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let state = "start";
  let player = { x: 0, y: 0, velocity: 0 };
  let obstacles = [];
  let score = 0;
  let bestScore = readBestScore();
  let spawnTimer = 0;
  let lastTime = 0;
  let animationFrame = 0;
  let idleTime = 0;

  function readBestScore() {
    try {
      return Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      localStorage.setItem(STORAGE_KEY, String(bestScore));
    } catch (_) {
      // The game remains playable if local storage is disabled.
    }
  }

  function resizeCanvas() {
    const bounds = shell.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state !== "playing") {
      player.x = width * 0.22;
      player.y = height * 0.47;
      draw();
    }
  }

  function startGame() {
    state = "playing";
    score = 0;
    scoreElement.textContent = "0";
    player = {
      x: Math.max(58, width * 0.19),
      y: height * 0.46,
      velocity: 0
    };
    obstacles = [];
    spawnTimer = 0.65;
    lastTime = performance.now();
    startScreen.classList.remove("is-visible");
    startScreen.hidden = true;
    gameOverScreen.classList.remove("is-visible");
    gameOverScreen.hidden = true;
    hud.classList.add("is-visible");
    status.textContent = "Gioco iniziato. Evita le offerte di lavoro.";
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(loop);
  }

  function endGame() {
    if (state !== "playing") return;
    state = "over";
    cancelAnimationFrame(animationFrame);
    hud.classList.remove("is-visible");

    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }

    finalScoreElement.textContent = String(score);
    bestScoreElement.textContent = String(bestScore);
    resultMessage.textContent = messageForScore(score);
    gameOverScreen.hidden = false;
    requestAnimationFrame(() => gameOverScreen.classList.add("is-visible"));
    status.textContent = `Partita terminata. ${score} offerte schivate.`;
  }

  function messageForScore(value) {
    if (value === 0) return "Ghostato ancora prima del colloquio conoscitivo.";
    if (value < 4) return "La RAL era “commisurata all’esperienza”. Peccato.";
    if (value < 8) return "Ottimo profilo! Ti ricontatteremo sicuramente.";
    if (value < 13) return "Sei ufficialmente overqualified per lo stage.";
    return "NaSPI speedrun completata. L’INPS è fiera di te.";
  }

  function flap() {
    if (state !== "playing") return;
    player.velocity = FLAP_FORCE;
  }

  function loop(time) {
    if (state !== "playing") return;
    const delta = Math.min((time - lastTime) / 1000, 0.034);
    lastTime = time;
    update(delta);
    draw();
    if (state === "playing") animationFrame = requestAnimationFrame(loop);
  }

  function update(delta) {
    player.velocity += GRAVITY * delta;
    player.y += player.velocity * delta;

    const hitbox = getPlayerHitbox();
    if (hitbox.top <= 0 || hitbox.bottom >= height) {
      endGame();
      return;
    }

    spawnTimer += delta;
    if (spawnTimer >= SPAWN_TIME) {
      spawnTimer -= SPAWN_TIME;
      spawnObstacle();
    }

    const speed = BASE_SPEED + Math.min(score * 3.2, 45);
    for (let index = obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = obstacles[index];
      obstacle.x -= speed * delta;

      if (!obstacle.scored && obstacle.x + obstacle.width < player.x) {
        obstacle.scored = true;
        score += 1;
        scoreElement.textContent = String(score);
      }

      if (collidesWith(obstacle)) {
        endGame();
        return;
      }

      if (obstacle.x + obstacle.width < -8) obstacles.splice(index, 1);
    }
  }

  function spawnObstacle() {
    const gap = Math.min(196, Math.max(158, height * 0.255));
    const edge = Math.max(76, height * 0.11);
    const available = Math.max(1, height - gap - edge * 2);
    const topHeight = edge + Math.random() * available;
    const offer = offers[Math.floor(Math.random() * offers.length)];

    obstacles.push({
      x: width + 12,
      width: Math.min(132, Math.max(112, width * 0.27)),
      topHeight,
      bottomY: topHeight + gap,
      offer,
      scored: false
    });
  }

  function collidesWith(obstacle) {
    // The hitbox follows almost the entire transparent cutout, including the head.
    const hitbox = getPlayerHitbox();
    const obstacleLeft = obstacle.x;
    const obstacleRight = obstacle.x + obstacle.width;

    if (hitbox.right < obstacleLeft || hitbox.left > obstacleRight) return false;
    return hitbox.top <= obstacle.topHeight || hitbox.bottom >= obstacle.bottomY;
  }

  function getPlayerHitbox() {
    const angle = Math.max(-0.42, Math.min(0.58, player.velocity / 920));
    const sine = Math.abs(Math.sin(angle));
    const cosine = Math.abs(Math.cos(angle));
    const rotatedHalfWidth =
      PLAYER_HITBOX_HALF_WIDTH * cosine + PLAYER_HITBOX_HALF_HEIGHT * sine;
    const rotatedHalfHeight =
      PLAYER_HITBOX_HALF_WIDTH * sine + PLAYER_HITBOX_HALF_HEIGHT * cosine;

    return {
      left: player.x - rotatedHalfWidth,
      right: player.x + rotatedHalfWidth,
      top: player.y - rotatedHalfHeight,
      bottom: player.y + rotatedHalfHeight
    };
  }

  function draw() {
    drawBackground();
    obstacles.forEach(drawObstacle);

    if (state === "playing") {
      drawPlayer(player.x, player.y, player.velocity);
    } else if (state === "start") {
      idleTime += 0.02;
      drawPlayer(width * 0.2, height * 0.48 + Math.sin(idleTime) * 7, -30);
    } else {
      drawPlayer(player.x, player.y, player.velocity);
    }
  }

  function drawBackground() {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#81d8d0");
    gradient.addColorStop(0.61, "#d9f3f0");
    gradient.addColorStop(0.611, "#d3cbbd");
    gradient.addColorStop(1, "#f7f1e5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,.55)";
    const drift = (performance.now() * 0.012) % (width + 180);
    for (let cloud = -1; cloud < 4; cloud += 1) {
      const x = cloud * 190 + drift - 180;
      const y = 82 + (cloud % 2) * 75;
      context.beginPath();
      context.arc(x, y, 27, 0, Math.PI * 2);
      context.arc(x + 28, y - 9, 36, 0, Math.PI * 2);
      context.arc(x + 65, y + 2, 24, 0, Math.PI * 2);
      context.fill();
    }

    const skylineY = height * 0.61;
    context.fillStyle = "rgba(17,17,17,.12)";
    for (let x = 0; x < width; x += 42) {
      const buildingHeight = 34 + ((x / 42) % 4) * 17;
      context.fillRect(x, skylineY - buildingHeight, 32, buildingHeight);
    }

    context.fillStyle = "rgba(17,17,17,.17)";
    context.fillRect(0, skylineY, width, 3);
    context.strokeStyle = "rgba(17,17,17,.13)";
    context.lineWidth = 3;
    context.setLineDash([22, 28]);
    context.beginPath();
    context.moveTo(0, height * 0.82);
    context.lineTo(width, height * 0.82);
    context.stroke();
    context.setLineDash([]);
  }

  function drawObstacle(obstacle) {
    drawOfferCard(obstacle.x, -10, obstacle.width, obstacle.topHeight + 10, obstacle.offer, true);
    drawOfferCard(
      obstacle.x,
      obstacle.bottomY,
      obstacle.width,
      height - obstacle.bottomY + 10,
      obstacle.offer,
      false
    );
  }

  function drawOfferCard(x, y, cardWidth, cardHeight, offer, isTop) {
    if (cardHeight <= 0) return;
    const radius = 12;
    const edgeY = isTop ? y + cardHeight - 114 : y;

    context.save();
    context.shadowColor = "rgba(17,17,17,.24)";
    context.shadowBlur = 0;
    context.shadowOffsetX = 6;
    context.shadowOffsetY = 6;
    roundedRect(x, y, cardWidth, cardHeight, radius);
    context.fillStyle = "#fffdf7";
    context.fill();
    context.shadowColor = "transparent";
    context.lineWidth = 3;
    context.strokeStyle = "#111111";
    context.stroke();

    context.save();
    roundedRect(x + 2, y + 2, cardWidth - 4, cardHeight - 4, Math.max(1, radius - 2));
    context.clip();

    context.fillStyle = offer.color;
    context.fillRect(x + 2, edgeY + 2, cardWidth - 4, 28);
    context.fillStyle = "#111111";
    context.font = "700 9px 'IBM Plex Sans', sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("JOB OFFER", x + 10, edgeY + 16);
    context.fillStyle = "rgba(17,17,17,.72)";
    context.textAlign = "right";
    context.fillText(isTop ? "↑" : "↓", x + cardWidth - 11, edgeY + 16);

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#111111";
    context.font = "700 8px 'IBM Plex Sans', sans-serif";
    context.fillText(trimText(offer.company, 20), x + 10, edgeY + 43);
    context.font = "700 13px 'IBM Plex Sans', sans-serif";
    drawWrappedText(offer.role, x + 10, edgeY + 59, cardWidth - 20, 14, 2);
    context.font = "400 9px 'IBM Plex Sans', sans-serif";
    context.fillStyle = "rgba(17,17,17,.72)";
    context.fillText(trimText(offer.detail, 24), x + 10, edgeY + 89);

    context.fillStyle = offer.color;
    context.fillRect(x + 8, edgeY + 94, cardWidth - 16, 18);
    context.fillStyle = "#111111";
    context.font = "700 8px 'IBM Plex Sans', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(trimText(offer.salary, 24), x + cardWidth / 2, edgeY + 103);
    context.restore();
    context.restore();
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius) {
    const r = Math.min(radius, Math.abs(rectWidth) / 2, Math.abs(rectHeight) / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r);
    context.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r);
    context.arcTo(x, y + rectHeight, x, y, r);
    context.arcTo(x, y, x + rectWidth, y, r);
    context.closePath();
  }

  function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(" ");
    let line = "";
    let lineNumber = 0;

    for (let index = 0; index < words.length; index += 1) {
      const testLine = line ? `${line} ${words[index]}` : words[index];
      if (context.measureText(testLine).width > maxWidth && line) {
        context.fillText(line, x, y + lineNumber * lineHeight);
        line = words[index];
        lineNumber += 1;
        if (lineNumber >= maxLines - 1) break;
      } else {
        line = testLine;
      }
    }
    context.fillText(trimText(line, 21), x, y + lineNumber * lineHeight);
  }

  function trimText(text, maximum) {
    return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text;
  }

  function drawPlayer(x, y, velocity) {
    const angle = Math.max(-0.42, Math.min(0.58, velocity / 920));
    const spriteHeight = PLAYER_SPRITE_HEIGHT;
    const spriteRatio = portrait.naturalWidth > 0
      ? portrait.naturalWidth / portrait.naturalHeight
      : 548 / 720;
    const spriteWidth = spriteHeight * spriteRatio;

    context.save();
    context.translate(x, y);
    context.rotate(angle);

    context.fillStyle = "rgba(17,17,17,.18)";
    context.beginPath();
    context.ellipse(7, spriteHeight * .46 + 10, spriteWidth * .43, 7, 0, 0, Math.PI * 2);
    context.fill();

    if (portrait.complete && portrait.naturalWidth > 0) {
      context.filter = "drop-shadow(2px 0 0 #111) drop-shadow(-2px 0 0 #111) drop-shadow(0 3px 0 #111) drop-shadow(4px 5px 0 rgba(238,61,37,.9))";
      context.drawImage(
        portrait,
        -spriteWidth / 2,
        -spriteHeight / 2,
        spriteWidth,
        spriteHeight
      );
      context.filter = "none";
    } else {
      context.fillStyle = "#ee3d25";
      context.fillRect(-spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
      context.fillStyle = "white";
      context.font = "700 18px 'IBM Plex Sans', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("AT", 0, 0);
    }
    context.restore();
  }

  function handleAction(event) {
    if (event) event.preventDefault();
    if (state === "playing") flap();
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", handleAction);

  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "ArrowUp") return;
    event.preventDefault();
    if (state === "playing") flap();
    else if (state === "start" || state === "over") startGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") endGame();
  });

  portrait.addEventListener("load", draw, { once: true });
  window.addEventListener("resize", resizeCanvas);
  new ResizeObserver(resizeCanvas).observe(shell);
  resizeCanvas();
  draw();
})();
