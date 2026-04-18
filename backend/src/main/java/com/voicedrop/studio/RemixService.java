package com.voicedrop.studio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

@Service
public class RemixService {

    private static final String AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
    private static final String MODEL = "google/gemini-3-flash-preview";

    private static final String SYSTEM_PROMPT = """
            You are an AI music producer system that generates structured remix track plans.
            Your output will be consumed by a backend service.
            You MUST follow all formatting rules strictly.
            RULES:
            - Output ONLY valid JSON
            - Do NOT include explanations, comments, markdown, or text outside JSON
            - All fields are REQUIRED
            - Use consistent units (seconds, BPM, semitones)
            - Keep values simple and programmatically usable
            - If unsure, choose a reasonable default
            """;

    private static final String TOOL_SCHEMA = """
            {
              "type": "function",
              "function": {
                "name": "remix_concept",
                "description": "Structured remix track plan",
                "parameters": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["analysis", "style", "structure", "vocal_processing", "instrumental_layers"],
                  "properties": {
                    "analysis": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": ["emotion", "intensity", "key_phrases"],
                      "properties": {
                        "emotion": { "type": "string", "enum": ["sad","happy","angry","confused","romantic","chaotic","neutral"] },
                        "intensity": { "type": "integer", "minimum": 1, "maximum": 10 },
                        "key_phrases": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 2 }
                      }
                    },
                    "style": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": ["genre", "bpm", "key", "energy"],
                      "properties": {
                        "genre": { "type": "string" },
                        "bpm": { "type": "integer" },
                        "key": { "type": "string" },
                        "energy": { "type": "string", "enum": ["low","medium","high"] }
                      }
                    },
                    "structure": {
                      "type": "array",
                      "minItems": 4,
                      "maxItems": 4,
                      "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["name", "start_sec", "end_sec", "description"],
                        "properties": {
                          "name": { "type": "string", "enum": ["intro","build","drop","outro"] },
                          "start_sec": { "type": "integer" },
                          "end_sec": { "type": "integer" },
                          "description": { "type": "string" }
                        }
                      }
                    },
                    "vocal_processing": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": ["mode", "main_phrase", "pitch_shift", "loop_pattern", "effects"],
                      "properties": {
                        "mode": { "type": "string", "enum": ["raw","chopped","pitched","glitch"] },
                        "main_phrase": { "type": "string" },
                        "pitch_shift": { "type": "integer" },
                        "loop_pattern": { "type": "string" },
                        "effects": {
                          "type": "object",
                          "additionalProperties": false,
                          "required": ["reverb", "delay", "distortion", "stutter"],
                          "properties": {
                            "reverb": { "type": "string", "enum": ["none","light","medium","heavy"] },
                            "delay": { "type": "string", "enum": ["none","light","medium","heavy"] },
                            "distortion": { "type": "boolean" },
                            "stutter": { "type": "boolean" }
                          }
                        }
                      }
                    },
                    "instrumental_layers": {
                      "type": "array",
                      "minItems": 3,
                      "maxItems": 5,
                      "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["type", "pattern", "intensity"],
                        "properties": {
                          "type": { "type": "string", "enum": ["drums","bass","pad","lead","fx"] },
                          "pattern": { "type": "string" },
                          "intensity": { "type": "string", "enum": ["low","medium","high"] }
                        }
                      }
                    }
                  }
                }
              }
            }
            """;

    @Value("${lovable.api.key}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public Map<String, Object> generateRemix(String transcript, String genre) {
        if (apiKey == null || apiKey.isBlank()) {
            return Map.of("ok", false, "error", "LOVABLE_API_KEY not configured");
        }

        try {
            String userMessage = "transcript: \"" + transcript + "\"\ngenre: \"" + genre + "\"\n\nProduce the remix track plan now.";

            String requestBody = mapper.writeValueAsString(Map.of(
                    "model", MODEL,
                    "messages", new Object[]{
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", userMessage)
                    },
                    "tools", new Object[]{mapper.readTree(TOOL_SCHEMA)},
                    "tool_choice", Map.of("type", "function", "function", Map.of("name", "remix_concept"))
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(AI_GATEWAY_URL))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 429) {
                return Map.of("ok", false, "error", "Rate limit reached. Please try again in a moment.");
            }
            if (response.statusCode() == 402) {
                return Map.of("ok", false, "error", "AI credits exhausted. Add funds in Settings → Workspace → Usage.");
            }
            if (response.statusCode() != 200) {
                System.err.println("AI gateway error " + response.statusCode() + ": " + response.body());
                return Map.of("ok", false, "error", "AI gateway error (" + response.statusCode() + ")");
            }

            JsonNode json = mapper.readTree(response.body());
            JsonNode arguments = json.at("/choices/0/message/tool_calls/0/function/arguments");
            if (arguments.isMissingNode() || arguments.isNull()) {
                return Map.of("ok", false, "error", "No structured response from AI.");
            }

            Object remix = mapper.readValue(arguments.asText(), Object.class);
            return Map.of("ok", true, "remix", remix);

        } catch (Exception e) {
            System.err.println("generateRemix failed: " + e.getMessage());
            return Map.of("ok", false, "error", "Something went wrong generating your remix.");
        }
    }
}
