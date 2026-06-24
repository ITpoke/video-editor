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

    this.video.addEventListener("loadedmetadata", () => {
      this.duration = this.video.duration * 1000;
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
      this.drawFrame();
      window.dispatchEvent(new CustomEvent("editor:metadata", { detail: { duration: this.duration } }));
    });

    this.video.addEventListener("ended", () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });
  }

  async loadVideo(file) {
    const url = URL.createObjectURL(file);
    this.video.src = url;
    this.video.load();
    return new Promise((resolve) => {
      this.video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
  }

  async loadImageAsOverlay(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const overlay = {
          id: generateId(),
          type: "image",
          img,
          x: 0,
          y: 0,
          width: Math.min(img.width, this.canvas.width),
          height: Math.min(img.height, this.canvas.height),
          startTime: 0,
          endTime: this.duration || 5000,
          url,
        };
        this.overlays.push(overlay);
        resolve(overlay);
        window.dispatchEvent(new CustomEvent("editor:overlays-changed"));
      };
      img.src = url;
    });
  }

  addTextOverlay(text, x = 100, y = 100, fontSize = 48, color = "#ffffff") {
    const overlay = {
      id: generateId(),
      type: "text",
      text,
      x,
      y,
      fontSize,
      color,
      startTime: 0,
      endTime: this.duration || 5000,
    };
    this.overlays.push(overlay);
    window.dispatchEvent(new CustomEvent("editor:overlays-changed"));
    return overlay;
  }

  addImageOverlay(img, startTime = 0, endTime = null) {
    const overlay = {
      id: generateId(),
      type: "image",
      img,
      x: 0,
      y: 0,
      width: Math.min(img.width, this.canvas.width),
      height: Math.min(img.height, this.canvas.height),
      startTime,
      endTime: endTime || this.duration || 5000,
      url: img.src,
    };
    this.overlays.push(overlay);
    window.dispatchEvent(new CustomEvent("editor:overlays-changed"));
    return overlay;
  }

  removeOverlay(id) {
    this.overlays = this.overlays.filter(o => o.id !== id);
    window.dispatchEvent(new CustomEvent("editor:overlays-changed"));
  }

  drawFrame() {
    const { ctx, canvas, video, overlays } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    const now = this.currentTime;
    overlays.forEach((o) => {
      if (now >= o.startTime && now <= o.endTime) {
        if (o.type === "text") {
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
      }
    });
  }

  play() {
    if (!this.video.src) return;
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

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stop() {
    this.pause();
    this.seekTo(0);
  }

  seekTo(ms) {
    this.currentTime = clamp(ms, 0, this.duration);
    this.video.currentTime = this.currentTime / 1000;
    this.drawFrame();
    window.dispatchEvent(new CustomEvent("editor:seek", { detail: { time: this.currentTime } }));
  }

  tick() {
    if (!this.isPlaying) return;
    this.currentTime = this.video.currentTime * 1000;
    this.drawFrame();
    window.dispatchEvent(new CustomEvent("editor:timeupdate", { detail: { time: this.currentTime } }));
    this.animationFrame = requestAnimationFrame(() => this.tick());
  }

  updatePlayButton() {
    const btn = document.getElementById("btn-play");
    if (btn) btn.innerHTML = this.isPlaying ? "&#9646;&#9646;" : "&#9654;";
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
}
