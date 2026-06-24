export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleGenerateImage(request: Request, env: Env) {
  const { prompt, steps = 4 } = await request.json<{ prompt: string; steps?: number }>();
  if (!prompt) return json({ error: "prompt is required" }, 400);

  const output = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
    prompt,
    steps,
  } as Ai_Cf_Black_Forest_Labs_Flux_1_Schnell_Input);

  const imageB64 = (output as Ai_Cf_Black_Forest_Labs_Flux_1_Schnell_Output).image;
  if (!imageB64) return json({ error: "No image generated" }, 500);

  const binaryStr = atob(imageB64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  return new Response(bytes, {
    headers: { "Content-Type": "image/png", ...corsHeaders },
  });
}

async function handleTTS(request: Request, env: Env) {
  const { text, lang = "en" } = await request.json<{ text: string; lang?: string }>();
  if (!text) return json({ error: "text is required" }, 400);

  const output = await env.AI.run("@cf/myshell-ai/melotts", {
    prompt: text,
    lang,
  } as AiTextToSpeechInput);

  if (output instanceof Uint8Array) {
    return new Response(output, {
      headers: { "Content-Type": "audio/wav", ...corsHeaders },
    });
  }

  const audioB64 = (output as { audio: string }).audio;
  if (!audioB64) return json({ error: "No audio generated" }, 500);

  const binaryStr = atob(audioB64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  return new Response(bytes, {
    headers: { "Content-Type": "audio/wav", ...corsHeaders },
  });
}

async function handleSpeechToText(request: Request, env: Env) {
  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!audio) {
    return json({ error: "audio file is required" }, 400);
  }

  const arrayBuf = await (audio as unknown as Blob).arrayBuffer();
  const audioData = Array.from(new Uint8Array(arrayBuf));

  const response = await env.AI.run("@cf/openai/whisper", {
    audio: audioData,
  } as Ai_Cf_Openai_Whisper_Input);

  return json(response);
}

async function handleObjectDetection(request: Request, env: Env) {
  const formData = await request.formData();
  const image = formData.get("image");
  if (!image) {
    return json({ error: "image file is required" }, 400);
  }

  const arrayBuf = await (image as unknown as Blob).arrayBuffer();

  const response = await env.AI.run("@cf/meta/detr-resnet-50", {
    image: Array.from(new Uint8Array(arrayBuf)),
  } as Record<string, unknown>);

  return json(response);
}

async function handleChat(request: Request, env: Env) {
  const { messages, editContext } = await request.json<{
    messages: { role: string; content: string }[];
    editContext?: Record<string, unknown>;
  }>();
  if (!messages?.length) return json({ error: "messages is required" }, 400);

  const contextStr = editContext ? `\nCurrent video state: ${JSON.stringify(editContext)}` : "";

  const systemPrompt = `You are an AI video editing assistant. You MUST perform actions by outputting JSON action objects. Always execute the user's request.

AVAILABLE ACTIONS (output one or more JSON objects):

TRIM video:
{"action":"trim","params":{"start":<seconds>,"end":<seconds>}}

CHANGE SPEED:
{"action":"speed","params":{"rate":0.5}} (0.25 to 4.0)

ADJUST VISUALS:
{"action":"brightness","params":{"value":130}} (0-200, default 100)
{"action":"contrast","params":{"value":130}} (0-200, default 100)
{"action":"saturate","params":{"value":150}} (0-200, default 100)
{"action":"blur","params":{"value":3}} (0-20 pixels)
{"action":"grayscale","params":{"value":100}} (0-100)
{"action":"sepia","params":{"value":100}} (0-100)
{"action":"reset_filters","params":{}}

ROTATE/FLIP:
{"action":"rotate","params":{"degrees":90}}
{"action":"flip","params":{"direction":"horizontal"}}
{"action":"flip","params":{"direction":"vertical"}}

ADD TEXT OVERLAY:
{"action":"add_text_overlay","params":{"text":"Hello World","x":100,"y":200,"fontSize":48,"color":"#ffffff","bgColor":"rgba(0,0,0,0.5)","start":0,"end":5}}

REMOVE TEXT:
{"action":"remove_text","params":{"text":"partial text to match"}}
{"action":"clear_text","params":{}}

ADD CAPTION (text at bottom with background):
{"action":"add_caption","params":{"text":"Caption here","start":0,"end":5}}

GENERATE IMAGE (AI image generation):
{"action":"generate_image","params":{"prompt":"sunset over ocean"}}

ADD VOICEOVER (text-to-speech):
{"action":"add_voiceover","params":{"text":"Welcome to our video"}}

DETECT OBJECTS in current frame:
{"action":"detect_objects","params":{}}

GET VIDEO INFO:
{"action":"get_info","params":{}}

RULES:
1. ALWAYS output the action JSON when the user asks you to edit something
2. You can output multiple actions in sequence
3. Use the current video state to make smart decisions
4. Be concise and friendly
5. After performing actions, confirm what you did${contextStr}`;

  const allMessages: RoleScopedChatInput[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const response = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
    messages: allMessages,
    max_tokens: 1024,
  } as AiTextGenerationInput);

  return json(response);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case "/api/generate-image":
          return await handleGenerateImage(request, env);
        case "/api/tts":
          return await handleTTS(request, env);
        case "/api/speech-to-text":
          return await handleSpeechToText(request, env);
        case "/api/detect-objects":
          return await handleObjectDetection(request, env);
        case "/api/chat":
          return await handleChat(request, env);
        default:
          return env.ASSETS.fetch(request);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return json({ error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
