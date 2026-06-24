class AIPanel {
  constructor(editor, timeline) {
    this.editor = editor;
    this.timeline = timeline;
    this.chatMessages = [];
    this.generatedImageUrl = null;
    this.ttsAudioUrl = null;

    this.setupTabs();
    this.setupChat();
    this.setupGenerate();
    this.setupTTS();
    this.setupDetect();
  }

  setupTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
      });
    });
  }

  setupChat() {
    const input = document.getElementById("chat-input");
    const btn = document.getElementById("btn-chat-send");

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      this.addChatMessage("user", text);

      try {
        this.chatMessages.push({ role: "user", content: text });
        const data = await apiPostJSON("/api/chat", { messages: this.chatMessages });
        const response = data.response || data.choices?.[0]?.message?.content || "No response";
        this.chatMessages.push({ role: "assistant", content: response });
        this.addChatMessage("ai", response);
        this.parseChatAction(response);
      } catch (err) {
        this.addChatMessage("ai", `Error: ${err.message}`);
      }
    };

    btn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
  }

  addChatMessage(role, text) {
    const container = document.getElementById("chat-messages");
    const el = createElement("div", `chat-msg ${role}`, { text });
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  parseChatAction(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (!jsonMatch) return;
      const action = JSON.parse(jsonMatch[0]);
      this.executeAction(action);
    } catch {
      // Not JSON, that's fine
    }
  }

  executeAction(action) {
    switch (action.action) {
      case "trim":
        this.editor.seekTo(action.params.start * 1000);
        break;
      case "add_text_overlay":
        this.editor.addTextOverlay(
          action.params.text,
          action.params.x || 100,
          action.params.y || 100,
          action.params.fontSize || 48
        );
        break;
      case "generate_image":
        document.getElementById("gen-prompt").value = action.params.prompt || "";
        document.querySelector('[data-tab="generate"]').click();
        this.handleGenerate();
        break;
      case "add_voiceover":
        document.getElementById("tts-text").value = action.params.text || "";
        document.querySelector('[data-tab="tts"]').click();
        this.handleTTS();
        break;
      case "add_caption":
        this.editor.addTextOverlay(
          action.params.text,
          50,
          this.editor.canvas.height - 80,
          32,
          "#ffffff"
        );
        break;
      case "reorder_clips":
        this.addChatMessage("ai", "Clip reordering is available in the timeline. Drag clips to rearrange.");
        break;
    }
  }

  setupGenerate() {
    const btn = document.getElementById("btn-generate");
    btn.addEventListener("click", () => this.handleGenerate());

    document.getElementById("btn-gen-add-overlay").addEventListener("click", () => {
      if (!this.generatedImageUrl) return;
      const img = new Image();
      img.onload = () => {
        this.editor.addImageOverlay(img);
        this.timeline.addOverlayClip("Generated Image", 0, this.editor.duration || 5000);
      };
      img.src = this.generatedImageUrl;
    });
  }

  async handleGenerate() {
    const prompt = document.getElementById("gen-prompt").value.trim();
    if (!prompt) return;

    const btn = document.getElementById("btn-generate");
    const preview = document.getElementById("gen-preview");
    const addBtn = document.getElementById("btn-gen-add-overlay");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';
    preview.innerHTML = "";
    addBtn.style.display = "none";

    try {
      const width = parseInt(document.getElementById("gen-width").value) || 512;
      const height = parseInt(document.getElementById("gen-height").value) || 512;
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width, height }),
      });

      const blob = await res.blob();
      this.generatedImageUrl = URL.createObjectURL(blob);
      preview.innerHTML = `<img src="${this.generatedImageUrl}" alt="Generated" />`;
      addBtn.style.display = "block";
    } catch (err) {
      preview.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Generate Image";
    }
  }

  setupTTS() {
    const btn = document.getElementById("btn-tts");
    btn.addEventListener("click", () => this.handleTTS());

    document.getElementById("btn-tts-add").addEventListener("click", () => {
      if (!this.ttsAudioUrl) return;
      const start = this.editor.currentTime;
      const audio = new Audio(this.ttsAudioUrl);
      audio.addEventListener("loadedmetadata", () => {
        const end = start + audio.duration * 1000;
        this.timeline.addAudioClip("Voiceover", start, end, null, this.ttsAudioUrl);
      });
    });
  }

  async handleTTS() {
    const text = document.getElementById("tts-text").value.trim();
    if (!text) return;

    const btn = document.getElementById("btn-tts");
    const preview = document.getElementById("tts-preview");
    const addBtn = document.getElementById("btn-tts-add");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';
    preview.innerHTML = "";
    addBtn.style.display = "none";

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const blob = await res.blob();
      this.ttsAudioUrl = URL.createObjectURL(blob);
      preview.innerHTML = `<audio controls src="${this.ttsAudioUrl}"></audio>`;
      addBtn.style.display = "block";
    } catch (err) {
      preview.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Generate Voice";
    }
  }

  setupDetect() {
    document.getElementById("btn-detect").addEventListener("click", () => this.handleDetect());
  }

  async handleDetect() {
    const results = document.getElementById("detect-results");
    const btn = document.getElementById("btn-detect");

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Detecting...';
    results.innerHTML = "";

    try {
      const blob = await this.editor.getCanvasBlob();
      const formData = new FormData();
      formData.append("image", blob, "frame.png");

      const res = await fetch("/api/detect-objects", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.length === 0) {
        results.innerHTML = "<p>No objects detected</p>";
        return;
      }

      data.forEach((item) => {
        const el = createElement("div", "detect-item", {
          html: `<span>${item.label || item.name || "Unknown"}</span><span class="detect-score">${(item.score * 100).toFixed(1)}%</span>`,
        });
        results.appendChild(el);
      });
    } catch (err) {
      results.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Detect Objects";
    }
  }
}
