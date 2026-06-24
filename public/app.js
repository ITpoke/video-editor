document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("video-canvas");
  const video = document.getElementById("hidden-video");
  const editor = new VideoEditor(canvas, video);
  const timeline = new Timeline(editor);
  const aiPanel = new AIPanel(editor, timeline);

  // File inputs
  const fileVideo = document.getElementById("file-input-video");
  const fileImage = document.getElementById("file-input-image");

  // Import buttons
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
    await editor.loadImageAsOverlay(file);
    timeline.addOverlayClip(file.name, 0, editor.duration || 5000);
  });

  // Playback controls
  document.getElementById("btn-play").addEventListener("click", () => editor.togglePlay());
  document.getElementById("btn-stop").addEventListener("click", () => editor.stop());

  // Time display
  window.addEventListener("editor:timeupdate", (e) => {
    document.getElementById("time-display").textContent =
      `${formatTime(e.detail.time)} / ${formatTime(editor.duration)}`;
    timeline.updatePlayhead();
  });

  window.addEventListener("editor:seek", (e) => {
    document.getElementById("time-display").textContent =
      `${formatTime(e.detail.time)} / ${formatTime(editor.duration)}`;
    timeline.updatePlayhead();
  });

  window.addEventListener("editor:metadata", () => {
    document.getElementById("time-display").textContent =
      `00:00.000 / ${formatTime(editor.duration)}`;
  });

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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

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

      editor.seekTo(0);
      recorder.start();

      // Play through video and record
      editor.play();

      const checkEnd = setInterval(() => {
        if (editor.currentTime >= editor.duration - 100) {
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
      case "Space":
        e.preventDefault();
        editor.togglePlay();
        break;
      case "Delete":
      case "Backspace":
        timeline.removeSelectedClip();
        break;
    }
  });

  // Drag & drop on canvas
  canvas.addEventListener("dragover", (e) => e.preventDefault());
  canvas.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith("video/")) {
      await editor.loadVideo(file);
      timeline.addVideoClip(file.name, 0, editor.duration);
    } else if (file.type.startsWith("image/")) {
      await editor.loadImageAsOverlay(file);
      timeline.addOverlayClip(file.name, 0, editor.duration || 5000);
    }
  });

  canvas.setAttribute("draggable", "true");
  canvas.addEventListener("dragstart", (e) => e.preventDefault());

  // Initial render
  editor.drawFrame();
  timeline.renderClips();
});
