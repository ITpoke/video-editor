class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.running = false;
    this.frame = null;
  }

  clear() { this.particles = []; }

  addParticle(p) { this.particles.push(p); }

  tick() {
    this.particles = this.particles.filter(p => {
      p.update();
      return p.life > 0;
    });
  }

  draw() {
    this.particles.forEach(p => p.draw(this.ctx));
  }
}

class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.life = opts.life || 100;
    this.maxLife = this.life;
    this.size = opts.size || 3;
    this.color = opts.color || "#ffffff";
    this.type = opts.type || "circle";
    this.rotation = opts.rotation || 0;
    this.rotSpeed = opts.rotSpeed || 0;
    this.gravity = opts.gravity || 0;
    this.fadeOut = opts.fadeOut !== false;
    this.glow = opts.glow || false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.rotSpeed;
    this.life--;
  }

  draw(ctx) {
    const alpha = this.fadeOut ? this.life / this.maxLife : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.glow) {
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = this.color;
    }

    if (this.type === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    } else if (this.type === "star") {
      this.drawStar(ctx, this.size);
    } else if (this.type === "snowflake") {
      this.drawSnowflake(ctx, this.size);
    } else if (this.type === "raindrop") {
      this.drawRain(ctx, this.size);
    } else if (this.type === "spark") {
      this.drawSpark(ctx, this.size);
    } else if (this.type === "petal") {
      this.drawPetal(ctx, this.size);
    } else if (this.type === "leaf") {
      this.drawLeaf(ctx, this.size);
    } else if (this.type === "bubble") {
      this.drawBubble(ctx, this.size);
    }

    ctx.restore();
  }

  drawStar(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? "moveTo" : "lineTo";
      ctx[method](Math.cos(angle) * s, Math.sin(angle) * s);
    }
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  drawSnowflake(ctx, s) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
      ctx.stroke();
    }
  }

  drawRain(ctx, s) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 3);
    ctx.stroke();
  }

  drawSpark(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, s * 2, 0, Math.PI * 2);
    ctx.fillStyle = this.color.replace(")", ",0.2)").replace("rgb", "rgba");
    ctx.fill();
  }

  drawPetal(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  drawLeaf(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s, 0, 0, s);
    ctx.quadraticCurveTo(-s, 0, 0, -s);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  drawBubble(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.3, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
  }
}

class EffectsEngine {
  constructor(editor) {
    this.editor = editor;
    this.canvas = editor.canvas;
    this.ctx = editor.ctx;
    this.systems = [];
    this.activeEffects = [];
    this.effectFrame = null;
    this.isRunning = false;
  }

  clearAll() {
    this.systems = [];
    this.activeEffects = [];
    this.isRunning = false;
  }

  // ---- EFFECT DEFINITIONS ----

  stars(opts = {}) {
    return {
      type: "stars",
      label: "Stars",
      count: opts.count || 80,
      region: opts.region || { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height * 0.5 },
      sizeRange: opts.sizeRange || [1, 4],
      twinkle: opts.twinkle !== false,
      color: opts.color || "#ffffff",
      glow: true,
    };
  }

  snow(opts = {}) {
    return {
      type: "snow",
      label: "Snowfall",
      count: opts.count || 120,
      speed: opts.speed || 2,
      wind: opts.wind || 0.5,
      sizeRange: opts.sizeRange || [2, 6],
      color: opts.color || "#ffffff",
    };
  }

  rain(opts = {}) {
    return {
      type: "rain",
      label: "Rain",
      count: opts.count || 200,
      speed: opts.speed || 12,
      wind: opts.wind || 2,
      length: opts.length || 15,
      color: opts.color || "rgba(150,180,255,0.6)",
    };
  }

  fireflies(opts = {}) {
    return {
      type: "fireflies",
      label: "Fireflies",
      count: opts.count || 40,
      color: opts.color || "#ffff44",
      glow: true,
    };
  }

  sakura(opts = {}) {
    return {
      type: "sakura",
      label: "Sakura Petals",
      count: opts.count || 60,
      speed: opts.speed || 1.5,
      color: opts.color || "#ffb7c5",
    };
  }

  bubbles(opts = {}) {
    return {
      type: "bubbles",
      label: "Bubbles",
      count: opts.count || 50,
      speed: opts.speed || 1.5,
      color: opts.color || "rgba(200,220,255,0.5)",
    };
  }

  leaves(opts = {}) {
    return {
      type: "leaves",
      label: "Falling Leaves",
      count: opts.count || 40,
      colors: opts.colors || ["#8B4513", "#D2691E", "#DAA520", "#FF8C00"],
    };
  }

  sparks(opts = {}) {
    return {
      type: "sparks",
      label: "Sparks",
      count: opts.count || 60,
      color: opts.color || "#ffaa00",
      glow: true,
    };
  }

  // ---- EFFECT PROCESSORS ----

  processStars(effect, w, h) {
    const particles = [];
    const r = effect.region;
    for (let i = 0; i < effect.count; i++) {
      const x = r.x + Math.random() * r.w;
      const y = r.y + Math.random() * r.h;
      const size = effect.sizeRange[0] + Math.random() * (effect.sizeRange[1] - effect.sizeRange[0]);
      particles.push(new Particle(x, y, {
        size,
        color: effect.color,
        type: "star",
        glow: effect.glow,
        life: 9999,
        fadeOut: false,
        vx: 0,
        vy: 0,
      }));
    }
    return particles;
  }

  processSnow(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w * 1.2 - w * 0.1;
      const y = -Math.random() * h;
      const size = effect.sizeRange[0] + Math.random() * (effect.sizeRange[1] - effect.sizeRange[0]);
      particles.push(new Particle(x, y, {
        size,
        color: effect.color,
        type: "snowflake",
        life: 9999,
        fadeOut: false,
        vx: effect.wind + (Math.random() - 0.5),
        vy: effect.speed + Math.random() * effect.speed,
      }));
    }
    return particles;
  }

  processRain(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w * 1.2 - w * 0.1;
      const y = -Math.random() * h;
      particles.push(new Particle(x, y, {
        size: 1,
        color: effect.color,
        type: "raindrop",
        life: 9999,
        fadeOut: false,
        vx: effect.wind,
        vy: effect.speed + Math.random() * 4,
      }));
    }
    return particles;
  }

  processFireflies(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      particles.push(new Particle(x, y, {
        size: 2 + Math.random() * 2,
        color: effect.color,
        type: "spark",
        glow: effect.glow,
        life: 9999,
        fadeOut: false,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
      }));
    }
    return particles;
  }

  processSakura(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w * 1.2 - w * 0.1;
      const y = -Math.random() * h * 0.3;
      particles.push(new Particle(x, y, {
        size: 3 + Math.random() * 4,
        color: effect.color,
        type: "petal",
        life: 9999,
        fadeOut: false,
        vx: effect.speed * 0.3 + Math.random() * 0.5,
        vy: effect.speed + Math.random(),
        rotSpeed: (Math.random() - 0.5) * 0.05,
      }));
    }
    return particles;
  }

  processBubbles(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w;
      const y = h + Math.random() * h * 0.3;
      particles.push(new Particle(x, y, {
        size: 4 + Math.random() * 10,
        color: effect.color,
        type: "bubble",
        life: 9999,
        fadeOut: false,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -effect.speed - Math.random() * effect.speed,
      }));
    }
    return particles;
  }

  processLeaves(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w * 1.2 - w * 0.1;
      const y = -Math.random() * h * 0.3;
      const color = effect.colors[Math.floor(Math.random() * effect.colors.length)];
      particles.push(new Particle(x, y, {
        size: 4 + Math.random() * 6,
        color,
        type: "leaf",
        life: 9999,
        fadeOut: false,
        vx: 0.5 + Math.random() * 0.5,
        vy: 1 + Math.random() * 1.5,
        rotSpeed: (Math.random() - 0.5) * 0.03,
      }));
    }
    return particles;
  }

  processSparks(effect, w, h) {
    const particles = [];
    for (let i = 0; i < effect.count; i++) {
      const x = Math.random() * w;
      const y = h * 0.5 + Math.random() * h * 0.5;
      particles.push(new Particle(x, y, {
        size: 1 + Math.random() * 2,
        color: effect.color,
        type: "spark",
        glow: effect.glow,
        life: 30 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 3,
        vy: -1 - Math.random() * 3,
        gravity: 0.05,
      }));
    }
    return particles;
  }

  // ---- MAIN API ----

  applyEffect(effectConfig) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    let particles = [];

    switch (effectConfig.type) {
      case "stars": particles = this.processStars(effectConfig, w, h); break;
      case "snow": particles = this.processSnow(effectConfig, w, h); break;
      case "rain": particles = this.processRain(effectConfig, w, h); break;
      case "fireflies": particles = this.processFireflies(effectConfig, w, h); break;
      case "sakura": particles = this.processSakura(effectConfig, w, h); break;
      case "bubbles": particles = this.processBubbles(effectConfig, w, h); break;
      case "leaves": particles = this.processLeaves(effectConfig, w, h); break;
      case "sparks": particles = this.processSparks(effectConfig, w, h); break;
    }

    this.activeEffects.push({ config: effectConfig, particles });
    this.start();
    return effectConfig.label;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.effectFrame) cancelAnimationFrame(this.effectFrame);
  }

  loop() {
    if (!this.isRunning) return;

    // Re-spawn particles that left the screen
    this.activeEffects.forEach(effect => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      effect.particles.forEach(p => {
        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y > h + 50) { p.y = -20; p.x = Math.random() * w; }
        if (p.y < -100) p.y = h + 20;
        if (p.life <= 0 && effect.config.type === "sparks") {
          p.x = Math.random() * w;
          p.y = h * 0.5 + Math.random() * h * 0.5;
          p.life = 30 + Math.random() * 60;
          p.vx = (Math.random() - 0.5) * 3;
          p.vy = -1 - Math.random() * 3;
        }
      });
    });

    // Draw particles on top of the video frame
    this.activeEffects.forEach(effect => {
      effect.particles.forEach(p => {
        p.update();
        p.draw(this.ctx);
      });
    });

    this.effectFrame = requestAnimationFrame(() => this.loop());
  }

  removeEffect(type) {
    this.activeEffects = this.activeEffects.filter(e => e.config.type !== type);
    if (this.activeEffects.length === 0) this.stop();
  }
}
