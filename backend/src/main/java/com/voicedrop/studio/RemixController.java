package com.voicedrop.studio;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class RemixController {

    private final RemixService remixService;

    public RemixController(RemixService remixService) {
        this.remixService = remixService;
    }

    @PostMapping("/generate-remix")
    public ResponseEntity<Map<String, Object>> generateRemix(@RequestBody RemixRequest request) {
        if (request.getTranscript() == null || request.getTranscript().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "transcript is required"));
        }
        if (request.getGenre() == null || request.getGenre().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "genre is required"));
        }

        return ResponseEntity.ok(remixService.generateRemix(request.getTranscript(), request.getGenre()));
    }
}
