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
        const data = await apiPostJSON("/api/chat", {
          messages: this.chatMessages,
          editContext: this.editor.getEditSummary(),
        });
        const response = data.response || data.choices?.[0]?.message?.content || "No response";
        this.chatMessages.push({ role: "assistant", content: response });
        this.addChatMessage("ai", response);
        this.parseAndExecute(response);
      } catch (err) {
        this.addChatMessage("ai", `Error: ${err.message}`);
      }
    };

    btn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }

  addChatMessage(role, text) {
    const container = document.getElementById("chat-messages");
    const el = createElement("div", `chat-msg ${role}`, { text });
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  parseAndExecute(response) {
    // Look for action blocks in the response
    const actionRegex = /\{"action"\s*:\s*"[^"]+"[^}]*\}/g;
    const matches = response.match(actionRegex);
    if (matches) {
      matches.forEach((match) => {
        try {
          const action = JSON.parse(match);
          this.executeAction(action);
        } catch {}
      });
    }
  }

  executeAction(action) {
    const e = this.editor;
    switch (action.action) {
      case "trim":
        e.trim(action.params.start * 1000, action.params.end * 1000);
        this.addChatMessage("ai", `Trimmed to ${action.params.start}s - ${action.params.end}s`);
        break;

      case "speed":
        e.setSpeed(action.params.rate);
        this.addChatMessage("ai", `Playback speed set to ${action.params.rate}x`);
        break;

      case "brightness":
        e.setBrightness(action.params.value);
        break;

      case "contrast":
        e.setContrast(action.params.value);
        break;

      case "saturate":
        e.setSaturate(action.params.value);
        break;

      case "blur":
        e.setBlur(action.params.value);
        break;

      case "grayscale":
        e.setGrayscale(action.params.value);
        break;

      case "sepia":
        e.setSepia(action.params.value);
        break;

      case "reset_filters":
        e.resetFilters();
        this.addChatMessage("ai", "All filters reset to default");
        break;

      case "rotate":
        e.rotate(action.params.degrees || 90);
        break;

      case "flip":
        if (action.params.direction === "horizontal") e.flipHorizontal();
        else e.flipVertical();
        break;

      case "add_text_overlay":
        e.addTextOverlay(
          action.params.text,
          action.params.x || 100,
          action.params.y || 100,
          action.params.fontSize || 48,
          action.params.color || "#ffffff",
          action.params.bgColor || null,
          action.params.start ? action.params.start * 1000 : undefined,
          action.params.end ? action.params.end * 1000 : undefined,
        );
        this.timeline.addOverlayClip(action.params.text, 0, e.trimEnd);
        this.addChatMessage("ai", `Added text overlay: "${action.params.text}"`);
        break;

      case "remove_text":
        e.overlays = e.overlays.filter(o => o.type !== "text" || !o.text.includes(action.params.text));
        e.drawFrame();
        break;

      case "clear_text":
        e.overlays = e.overlays.filter(o => o.type !== "text");
        e.drawFrame();
        this.addChatMessage("ai", "Cleared all text overlays");
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

      case "detect_objects":
        this.handleDetect();
        break;

      case "add_caption":
        e.addTextOverlay(
          action.params.text,
          50,
          e.canvas.height - 80,
          32,
          "#ffffff",
          "rgba(0,0,0,0.6)",
          action.params.start ? action.params.start * 1000 : undefined,
          action.params.end ? action.params.end * 1000 : undefined,
        );
        this.addChatMessage("ai", `Added caption: "${action.params.text}"`);
        break;

      case "get_info":
        const info = e.getEditSummary();
        this.addChatMessage("ai", `Video info: Duration ${info.duration / 1000}s, Trim ${info.trimStart / 1000}s-${info.trimEnd / 1000}s, Speed ${info.playbackRate}x, ${info.overlayCount} overlays`);
        break;

      case "apply_effect":
        const effectType = action.params.type;
        const effectOpts = action.params.opts || {};
        const effectConfig = e.effects[effectType](effectOpts);
        e.effects.applyEffect(effectConfig);
        this.addChatMessage("ai", `Applied effect: ${effectConfig.label}`);
        break;

      case "remove_effect":
        e.effects.removeEffect(action.params.type);
        this.addChatMessage("ai", `Removed ${action.params.type} effect`);
        break;

      case "clear_effects":
        e.effects.clearAll();
        this.addChatMessage("ai", "Cleared all effects");
        break;

      case "detect_and_edit":
        this.handleDetectAndEdit(action.params.description);
        break;
    }
  }

  async handleDetectAndEdit(description) {
    this.addChatMessage("ai", `Analyzing video frame and applying: "${description}"`);
    try {
      const blob = await this.editor.getCanvasBlob();
      const formData = new FormData();
      formData.append("image", blob, "frame.png");
      const detectRes = await fetch("/api/detect-objects", { method: "POST", body: formData });
      const detected = await detectRes.json();
      const sceneDesc = detected.map(d => `${d.label} (${(d.score * 100).toFixed(0)}%)`).join(", ");
      this.addChatMessage("ai", `Detected: ${sceneDesc || "nothing specific"}`);

      const chatRes = await apiPostJSON("/api/chat", {
        messages: [
          { role: "user", content: `I detected these objects in the video: ${sceneDesc}. The user wants: "${description}". What effects should I apply? Respond with JSON action objects.` },
        ],
        editContext: this.editor.getEditSummary(),
      });
      const response = chatRes.response || chatRes.choices?.[0]?.message?.content || "";
      this.addChatMessage("ai", response);
      this.parseAndExecute(response);
    } catch (err) {
      this.addChatMessage("ai", `Error: ${err.message}`);
    }
  }

  setupGenerate() {
    document.getElementById("btn-generate").addEventListener("click", () => this.handleGenerate());
    document.getElementById("btn-gen-add-overlay").addEventListener("click", () => {
      if (!this.generatedImageUrl) return;
      const img = new Image();
      img.onload = () => {
        this.editor.addImageOverlay(img);
        this.timeline.addOverlayClip("Generated Image", 0, this.editor.trimEnd);
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
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, steps: 4 }),
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
    document.getElementById("btn-tts").addEventListener("click", () => this.handleTTS());
    document.getElementById("btn-tts-add").addEventListener("click", () => {
      if (!this.ttsAudioUrl) return;
      const start = this.editor.currentTime;
      const audio = new Audio(this.ttsAudioUrl);
      audio.addEventListener("loadedmetadata", () => {
        const end = start + audio.duration * 1000;
        this.timeline.addAudioClip("Voiceover", start, end, null, this.ttsAudioUrl);
        this.addChatMessage("ai", `Added voiceover from ${start / 1000}s to ${end / 1000}s`);
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
      const res = await fetch("/api/detect-objects", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.length) { results.innerHTML = "<p>No objects detected</p>"; return; }
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
