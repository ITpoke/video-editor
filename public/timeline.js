class Timeline {
  constructor(editor) {
    this.editor = editor;
    this.zoom = 100;
    this.clips = { video: [], audio: [], overlay: [] };
    this.selectedClip = null;
    this.dragging = null;
    this.dragOffset = 0;

    this.videoTrack = document.getElementById("video-track-content");
    this.audioTrack = document.getElementById("audio-track-content");
    this.overlayTrack = document.getElementById("overlay-track-content");
    this.playhead = document.getElementById("playhead");

    this.setupEvents();
  }

  setupEvents() {
    document.getElementById("btn-zoom-in").addEventListener("click", () => this.setZoom(this.zoom + 20));
    document.getElementById("btn-zoom-out").addEventListener("click", () => this.setZoom(this.zoom - 20));
    document.getElementById("btn-add-scene").addEventListener("click", () => this.addBlankClip());

    const trackEl = document.getElementById("timeline-tracks");
    trackEl.addEventListener("click", (e) => {
      if (e.target === trackEl || e.target.classList.contains("track-content")) {
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left + trackEl.scrollLeft - 72;
        const ms = pxToTime(x, this.zoom);
        this.editor.seekTo(ms);
        this.updatePlayhead();
      }
    });

    trackEl.addEventListener("mousedown", (e) => {
      const clipEl = e.target.closest(".clip");
      if (!clipEl) return;
      e.preventDefault();
      const track = clipEl.parentElement.id.replace("-track-content", "");
      const clipId = clipEl.dataset.id;
      const clip = this.clips[track].find(c => c.id === clipId);
      if (!clip) return;

      this.selectClip(track, clipId);
      this.dragging = { track, clip, clipEl };
      const rect = clipEl.getBoundingClientRect();
      this.dragOffset = e.clientX - rect.left;

      const onMove = (e2) => {
        const trackRect = this.videoTrack.getBoundingClientRect();
        const x = e2.clientX - trackRect.left - this.dragOffset;
        const ms = Math.max(0, pxToTime(x, this.zoom));
        clip.start = ms;
        clip.end = ms + (clip.end - clip.start);
        this.renderClips();
        this.editor.seekTo(ms);
      };

      const onUp = () => {
        this.dragging = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  setZoom(z) {
    this.zoom = clamp(z, 20, 500);
    this.renderClips();
    this.updatePlayhead();
  }

  selectClip(track, id) {
    this.selectedClip = { track, id };
    document.querySelectorAll(".clip").forEach(el => el.classList.remove("selected"));
    const el = document.querySelector(`.clip[data-id="${id}"]`);
    if (el) el.classList.add("selected");
  }

  addVideoClip(name, startMs, endMs) {
    const clip = {
      id: generateId(),
      name,
      start: startMs,
      end: endMs,
      duration: endMs - startMs,
    };
    this.clips.video.push(clip);
    this.renderClips();
    return clip;
  }

  addAudioClip(name, startMs, endMs, audioBuffer = null, audioUrl = null) {
    const clip = {
      id: generateId(),
      name,
      start: startMs,
      end: endMs,
      duration: endMs - startMs,
      audioBuffer,
      audioUrl,
    };
    this.clips.audio.push(clip);
    this.renderClips();
    return clip;
  }

  addOverlayClip(name, startMs, endMs) {
    const clip = {
      id: generateId(),
      name,
      start: startMs,
      end: endMs,
      duration: endMs - startMs,
    };
    this.clips.overlay.push(clip);
    this.renderClips();
    return clip;
  }

  addBlankClip() {
    const lastEnd = this.clips.video.reduce((max, c) => Math.max(max, c.end), 0);
    this.addVideoClip(`Scene ${this.clips.video.length + 1}`, lastEnd, lastEnd + 5000);
  }

  removeSelectedClip() {
    if (!this.selectedClip) return;
    const { track, id } = this.selectedClip;
    this.clips[track] = this.clips[track].filter(c => c.id !== id);
    this.selectedClip = null;
    this.renderClips();
  }

  renderClips() {
    this.renderTrack(this.videoTrack, this.clips.video, "clip-video");
    this.renderTrack(this.audioTrack, this.clips.audio, "clip-audio");
    this.renderTrack(this.overlayTrack, this.clips.overlay, "clip-overlay");
  }

  renderTrack(container, clips, className) {
    container.innerHTML = "";
    clips.forEach((clip) => {
      const left = timeToPx(clip.start, this.zoom);
      const width = timeToPx(clip.duration, this.zoom);
      const el = createElement("div", `clip ${className}`, {
        "data-id": clip.id,
        text: clip.name,
      });
      el.style.left = `${left}px`;
      el.style.width = `${Math.max(width, 4)}px`;
      container.appendChild(el);
    });
  }

  updatePlayhead() {
    const x = timeToPx(this.editor.currentTime, this.zoom);
    this.playhead.style.left = `${72 + x}px`;
  }

  getClipsByTrack(track) {
    return [...this.clips[track]].sort((a, b) => a.start - b.start);
  }
}
