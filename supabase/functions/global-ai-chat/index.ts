import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SYSTEM_PROMPT = `You are Sharpfunds AI, a knowledgeable financial assistant. Rules:
- NEVER give buy/sell/hold recommendations or price predictions
- Always end with "_Informational only. Not investment advice._"
- Be concise (2-4 paragraphs), reference specific data when provided
- Use **bold** for key terms, be conversational but professional`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });

  try {
    const { messages, userContext, recentHeadlines, currentPrices } = await req.json();

    const groqKey = Deno.env.get("GROQ_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const contextStr = [
      `User: ${userContext?.displayName || "Investor"}`,
      `Risk: ${userContext?.riskTolerance || "balanced"}`,
      `Experience: ${userContext?.experienceLevel || "intermediate"}`,
      `Tracked: ${userContext?.trackedAssets?.map((a: any) => a.symbol).join(", ") || "none"}`,
      recentHeadlines?.length ? `Headlines: ${recentHeadlines.slice(0, 5).join(" | ")}` : "",
      currentPrices?.length ? `Prices: ${currentPrices.map((p: any) => `${p.symbol}=$${p.price}(${p.changePercent > 0 ? "+" : ""}${p.changePercent.toFixed(2)}%)`).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    // Try Groq first
    if (groqKey) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\nContext:\n${contextStr}` }, ...(messages || [])], max_tokens: 500, temperature: 0.7 }),
        });
        if (res.ok) {
          const data = await res.json();
          return new Response(JSON.stringify({ response: data.choices?.[0]?.message?.content || "No response generated." }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }
      } catch { /* fallthrough to Gemini */ }
    }

    // Fallback: Gemini
    if (geminiKey) {
      try {
        const userMsg = (messages || []).map((m: any) => `${m.role}: ${m.content}`).join("\n");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Context:\n${contextStr}\n\nConversation:\n${userMsg}` }] }], systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
          return new Response(JSON.stringify({ response: text }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }
      } catch { /* fallthrough */ }
    }

    return new Response(JSON.stringify({ response: "AI services are currently unavailable. Please try again later. _Informational only. Not investment advice._" }), { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
