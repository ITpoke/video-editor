class VideoEditor {
  constructor(canvas, videoEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.video = videoEl;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.overlays = [];
    this.animationFrame = null;
    this.trimStart = 0;
    this.trimEnd = 0;
    this.playbackRate = 1;
    this.volume = 1;
    this.brightness = 100;
    this.contrast = 100;
    this.saturate = 100;
    this.blur = 0;
    this.grayscale = 0;
    this.sepia = 0;
    this.rotation = 0;
    this.flipX = false;
    this.flipY = false;
    this.textEffects = [];
    this.effects = new EffectsEngine(this);
    this.onEdit = null;

    this.video.addEventListener("loadedmetadata", () => {
      this.duration = this.video.duration * 1000;
      this.trimEnd = this.duration;
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
      this.drawFrame();
      this.emit("metadata");
    });

    this.video.addEventListener("ended", () => {
      if (this.video.currentTime * 1000 >= this.trimEnd) {
        this.isPlaying = false;
        this.updatePlayButton();
      }
    });
  }

  emit(event, data = {}) {
    window.dispatchEvent(new CustomEvent(`editor:${event}`, { detail: data }));
    if (this.onEdit) this.onEdit(event, data);
  }

  async loadVideo(file) {
    const url = URL.createObjectURL(file);
    this.video.src = url;
    this.video.load();
    return new Promise((resolve) => {
      this.video.addEventListener("loadeddata", () => {
        this.trimStart = 0;
        this.trimEnd = this.video.duration * 1000;
        resolve();
      }, { once: true });
    });
  }

  // ---- REAL EDITING OPERATIONS ----

  trim(startMs, endMs) {
    this.trimStart = Math.max(0, startMs);
    this.trimEnd = Math.min(this.duration, endMs);
    this.seekTo(this.trimStart);
    this.emit("edit", { action: "trim", start: startMs, end: endMs });
  }

  setSpeed(rate) {
    this.playbackRate = rate;
    this.video.playbackRate = rate;
    this.emit("edit", { action: "speed", rate });
  }

  setVolume(vol) {
    this.volume = vol;
    this.video.volume = vol;
    this.emit("edit", { action: "volume", volume: vol });
  }

  setBrightness(val) { this.brightness = val; this.drawFrame(); this.emit("edit", { action: "brightness", value: val }); }
  setContrast(val) { this.contrast = val; this.drawFrame(); this.emit("edit", { action: "contrast", value: val }); }
  setSaturate(val) { this.saturate = val; this.drawFrame(); this.emit("edit", { action: "saturate", value: val }); }
  setBlur(val) { this.blur = val; this.drawFrame(); this.emit("edit", { action: "blur", value: val }); }
  setGrayscale(val) { this.grayscale = val; this.drawFrame(); this.emit("edit", { action: "grayscale", value: val }); }
  setSepia(val) { this.sepia = val; this.drawFrame(); this.emit("edit", { action: "sepia", value: val }); }

  resetFilters() {
    this.brightness = 100; this.contrast = 100; this.saturate = 100;
    this.blur = 0; this.grayscale = 0; this.sepia = 0;
    this.playbackRate = 1; this.video.playbackRate = 1;
    this.drawFrame();
    this.emit("edit", { action: "reset_filters" });
  }

  rotate(deg) { this.rotation = (this.rotation + deg) % 360; this.drawFrame(); this.emit("edit", { action: "rotate", degrees: this.rotation }); }
  flipHorizontal() { this.flipX = !this.flipX; this.drawFrame(); this.emit("edit", { action: "flip_h" }); }
  flipVertical() { this.flipY = !this.flipY; this.drawFrame(); this.emit("edit", { action: "flip_v" }); }

  // ---- OVERLAYS ----

  addTextOverlay(text, x = 100, y = 100, fontSize = 48, color = "#ffffff", bgColor = null, startTime = null, endTime = null) {
    const overlay = {
      id: generateId(), type: "text", text, x, y, fontSize, color, bgColor,
      startTime: startTime ?? this.trimStart, endTime: endTime ?? this.trimEnd,
    };
    this.overlays.push(overlay);
    this.drawFrame();
    this.emit("overlays-changed");
    return overlay;
  }

  addImageOverlay(img, x = 0, y = 0, width = null, height = null, startTime = null, endTime = null) {
    const overlay = {
      id: generateId(), type: "image", img, x, y,
      width: width ?? Math.min(img.width, this.canvas.width),
      height: height ?? Math.min(img.height, this.canvas.height),
      startTime: startTime ?? this.trimStart, endTime: endTime ?? this.trimEnd,
    };
    this.overlays.push(overlay);
    this.drawFrame();
    this.emit("overlays-changed");
    return overlay;
  }

  async addImageFromFile(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const overlay = this.addImageOverlay(img);
        resolve(overlay);
      };
      img.src = url;
    });
  }

  removeOverlay(id) {
    this.overlays = this.overlays.filter(o => o.id !== id);
    this.drawFrame();
    this.emit("overlays-changed");
  }

  removeOverlaysByType(type) {
    this.overlays = this.overlays.filter(o => o.type !== type);
    this.drawFrame();
    this.emit("overlays-changed");
  }

  clearOverlays() {
    this.overlays = [];
    this.drawFrame();
    this.emit("overlays-changed");
  }

  updateOverlay(id, changes) {
    const overlay = this.overlays.find(o => o.id === id);
    if (overlay) {
      Object.assign(overlay, changes);
      this.drawFrame();
      this.emit("overlays-changed");
    }
  }

  // ---- PLAYBACK ----

  async loadVideoAsOverlay(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const overlay = {
          id: generateId(), type: "image", img, x: 0, y: 0,
          width: Math.min(img.width, this.canvas.width),
          height: Math.min(img.height, this.canvas.height),
          startTime: this.trimStart, endTime: this.trimEnd, url,
        };
        this.overlays.push(overlay);
        resolve(overlay);
        this.emit("overlays-changed");
      };
      img.src = url;
    });
  }

  play() {
    if (!this.video.src) return;
    if (this.video.currentTime * 1000 < this.trimStart || this.video.currentTime * 1000 >= this.trimEnd) {
      this.video.currentTime = this.trimStart / 1000;
    }
    this.video.play();
    this.isPlaying = true;
    this.updatePlayButton();
    this.tick();
  }

  pause() {
    this.video.pause();
    this.isPlaying = false;
    this.updatePlayButton();
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  togglePlay() { this.isPlaying ? this.pause() : this.play(); }

  stop() { this.pause(); this.seekTo(this.trimStart); }

  seekTo(ms) {
    this.currentTime = clamp(ms, this.trimStart, this.trimEnd);
    this.video.currentTime = this.currentTime / 1000;
    this.drawFrame();
    this.emit("seek", { time: this.currentTime });
  }

  tick() {
    if (!this.isPlaying) return;
    this.currentTime = this.video.currentTime * 1000;
    if (this.currentTime >= this.trimEnd) {
      this.pause();
      return;
    }
    this.drawFrame();
    this.emit("timeupdate", { time: this.currentTime });
    this.animationFrame = requestAnimationFrame(() => this.tick());
  }

  updatePlayButton() {
    const btn = document.getElementById("btn-play");
    if (btn) btn.innerHTML = this.isPlaying ? "&#9646;&#9646;" : "&#9654;";
  }

  // ---- RENDERING ----

  getFilterString() {
    let f = `brightness(${this.brightness}%) contrast(${this.contrast}%) saturate(${this.saturate}%)`;
    if (this.blur > 0) f += ` blur(${this.blur}px)`;
    if (this.grayscale > 0) f += ` grayscale(${this.grayscale}%)`;
    if (this.sepia > 0) f += ` sepia(${this.sepia}%)`;
    return f;
  }

  drawFrame() {
    const { ctx, canvas, video } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply transforms
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (this.rotation) ctx.rotate((this.rotation * Math.PI) / 180);
    if (this.flipX) ctx.scale(-1, 1);
    if (this.flipY) ctx.scale(1, -1);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Apply filters
    ctx.filter = this.getFilterString();

    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Import a video to start editing", canvas.width / 2, canvas.height / 2);
    }

    ctx.restore();

    // Draw overlays
    const now = this.currentTime;
    this.overlays.forEach((o) => {
      if (now >= o.startTime && now <= o.endTime) {
        ctx.save();
        if (o.type === "text") {
          if (o.bgColor) {
            ctx.fillStyle = o.bgColor;
            const textWidth = ctx.measureText(o.text).width;
            ctx.fillRect(o.x - 4, o.y - o.fontSize, textWidth + 8, o.fontSize + 8);
          }
          ctx.font = `bold ${o.fontSize}px sans-serif`;
          ctx.fillStyle = o.color;
          ctx.textAlign = "left";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.fillText(o.text, o.x, o.y + o.fontSize);
          ctx.shadowBlur = 0;
        } else if (o.type === "image" && o.img) {
          ctx.drawImage(o.img, o.x, o.y, o.width, o.height);
        }
        ctx.restore();
      }
    });
  }

  getCanvasBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, "image/png");
    });
  }

  getCurrentFrameImage() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(this.canvas, 0, 0);
    return tempCanvas.toDataURL("image/png");
  }

  getEditSummary() {
    return {
      duration: this.duration,
      trimStart: this.trimStart,
      trimEnd: this.trimEnd,
      playbackRate: this.playbackRate,
      brightness: this.brightness,
      contrast: this.contrast,
      saturate: this.saturate,
      blur: this.blur,
      grayscale: this.grayscale,
      sepia: this.sepia,
      rotation: this.rotation,
      flipX: this.flipX,
      flipY: this.flipY,
      overlayCount: this.overlays.length,
      overlays: this.overlays.map(o => ({ type: o.type, text: o.text, id: o.id })),
    };
  }
}
