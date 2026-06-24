document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("video-canvas");
  const video = document.getElementById("hidden-video");
  const editor = new VideoEditor(canvas, video);
  const timeline = new Timeline(editor);
  const aiPanel = new AIPanel(editor, timeline);

  const fileVideo = document.getElementById("file-input-video");
  const fileImage = document.getElementById("file-input-image");

  // Import
  document.getElementById("btn-import").addEventListener("click", () => fileVideo.click());
  document.getElementById("btn-import-image").addEventListener("click", () => fileImage.click());

  fileVideo.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await editor.loadVideo(file);
    timeline.addVideoClip(file.name, 0, editor.duration);
    editor.play();
  });

  fileImage.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const overlay = await editor.addImageFromFile(file);
    timeline.addOverlayClip(file.name, 0, editor.trimEnd);
  });

  // Playback
  document.getElementById("btn-play").addEventListener("click", () => editor.togglePlay());
  document.getElementById("btn-stop").addEventListener("click", () => editor.stop());

  // Time display
  window.addEventListener("editor:timeupdate", (e) => {
    document.getElementById("time-display").textContent =
      `${formatTime(e.detail.time)} / ${formatTime(editor.trimEnd)}`;
    timeline.updatePlayhead();
  });

  window.addEventListener("editor:seek", (e) => {
    document.getElementById("time-display").textContent =
      `${formatTime(e.detail.time)} / ${formatTime(editor.trimEnd)}`;
    timeline.updatePlayhead();
  });

  window.addEventListener("editor:metadata", () => {
    document.getElementById("time-display").textContent =
      `00:00.000 / ${formatTime(editor.trimEnd)}`;
  });

  // Edit controls
  document.getElementById("ctrl-speed").addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    editor.setSpeed(val);
    document.getElementById("ctrl-speed-val").textContent = `${val}x`;
  });

  document.getElementById("ctrl-brightness").addEventListener("input", (e) => {
    editor.setBrightness(parseInt(e.target.value));
  });

  document.getElementById("ctrl-contrast").addEventListener("input", (e) => {
    editor.setContrast(parseInt(e.target.value));
  });

  document.getElementById("ctrl-saturate").addEventListener("input", (e) => {
    editor.setSaturate(parseInt(e.target.value));
  });

  document.getElementById("ctrl-reset").addEventListener("click", () => {
    editor.resetFilters();
    document.getElementById("ctrl-speed").value = 1;
    document.getElementById("ctrl-speed-val").textContent = "1x";
    document.getElementById("ctrl-brightness").value = 100;
    document.getElementById("ctrl-contrast").value = 100;
    document.getElementById("ctrl-saturate").value = 100;
  });

  document.getElementById("ctrl-rotate").addEventListener("click", () => editor.rotate(90));
  document.getElementById("ctrl-flip-h").addEventListener("click", () => editor.flipHorizontal());

  // Export
  document.getElementById("btn-export").addEventListener("click", async () => {
    const btn = document.getElementById("btn-export");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Exporting...';
    try {
      const stream = canvas.captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5000000,
      });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "edited-video.webm";
        a.click();
        URL.revokeObjectURL(url);
        btn.disabled = false;
        btn.textContent = "Export Video";
      };
      editor.seekTo(editor.trimStart);
      recorder.start();
      editor.play();
      const checkEnd = setInterval(() => {
        if (editor.currentTime >= editor.trimEnd - 100) {
          clearInterval(checkEnd);
          editor.pause();
          recorder.stop();
        }
      }, 100);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
      btn.disabled = false;
      btn.textContent = "Export Video";
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    switch (e.code) {
      case "Space": e.preventDefault(); editor.togglePlay(); break;
      case "Delete": case "Backspace": timeline.removeSelectedClip(); break;
      case "ArrowLeft": editor.seekTo(editor.currentTime - 5000); break;
      case "ArrowRight": editor.seekTo(editor.currentTime + 5000); break;
      case "KeyF": editor.setSpeed(Math.min(editor.playbackRate + 0.25, 4)); break;
      case "KeyS": editor.setSpeed(Math.max(editor.playbackRate - 0.25, 0.25)); break;
    }
  });

  // Drag & drop
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      await editor.loadVideo(file);
      timeline.addVideoClip(file.name, 0, editor.duration);
    } else if (file.type.startsWith("image/")) {
      await editor.addImageFromFile(file);
      timeline.addOverlayClip(file.name, 0, editor.trimEnd);
    }
  });
  canvas.setAttribute("draggable", "true");
  canvas.addEventListener("dragstart", (e) => e.preventDefault());

  // Initial render
  editor.drawFrame();
  timeline.renderClips();
});
