import Foundation
import AVFoundation
import Capacitor

// ============================================================================
// NativeTts — FREE, on-device text-to-speech for iOS / iPadOS.
// ----------------------------------------------------------------------------
// Mirrors the desktop free `say` path: keyless (free) users get an audible,
// multi-voice podcast synthesized entirely on the device using Apple's built-in
// AVSpeechSynthesizer. NOTHING is sent to a paid API — a free user never touches
// anyone's OpenAI key. When higher-quality (Enhanced / Premium) system voices
// are installed, they are preferred automatically; a plain default voice is used
// otherwise (graceful fallback, always audible).
//
// `synthesizePodcast` renders an ENTIRE multi-segment script into ONE audio file
// on device: each segment can use its own voice, so two speakers get two
// DISTINCT voices, and every utterance's audio buffers are appended to a single
// AVAudioFile (m4a/AAC) — no server, no ffmpeg, no cost. The finished file's
// path, URI and base64 are returned to the JS/TS layer.
//
// Registered automatically via the CAPBridgedPlugin protocol (Capacitor 6+),
// so no ObjC macro file is required.
// ============================================================================

@objc(NativeTtsPlugin)
public class NativeTtsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTtsPlugin"
    public let jsName = "NativeTts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "synthesizePodcast", returnType: CAPPluginReturnPromise)
    ]

    // Retained for the life of the plugin so its write callbacks aren't dropped.
    private let synthesizer = AVSpeechSynthesizer()

    // Quality rank so we always prefer the most natural installed tier.
    // AVSpeechSynthesisVoiceQuality is Int-backed (default=1, enhanced=2,
    // premium=3); ranking by rawValue avoids referencing the iOS-16-only
    // `.premium` case on our iOS 15 deployment target.
    private func rank(_ q: AVSpeechSynthesisVoiceQuality) -> Int {
        return q.rawValue
    }

    private func qualityLabel(_ q: AVSpeechSynthesisVoiceQuality) -> String {
        switch q.rawValue {
        case 3: return "premium"
        case 2: return "enhanced"
        default: return "default"
        }
    }

    private func genderString(_ v: AVSpeechSynthesisVoice) -> String {
        switch v.gender {
        case .male: return "male"
        case .female: return "female"
        default: return "unspecified"
        }
    }

    // Map an OpenAI-style voice key to a rough gender flavor so the spoken voice
    // matches the intended speaker.
    private func genderFlavor(forVoiceKey key: String) -> AVSpeechSynthesisVoiceGender {
        switch key.lowercased() {
        case "nova", "shimmer": return .female
        case "onyx", "echo": return .male
        default: return .unspecified
        }
    }

    // English voices installed on this device, best quality first.
    private func englishVoices() -> [AVSpeechSynthesisVoice] {
        return AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.lowercased().hasPrefix("en") }
            .sorted { rank($0.quality) > rank($1.quality) }
    }

    // Assign each distinct voice key a DISTINCT AVSpeechSynthesisVoice, preferring
    // the requested gender and the highest quality tier, so two speakers never
    // share a voice (as long as >= 2 English voices exist).
    private func pickVoices(for keys: [String]) -> [String: AVSpeechSynthesisVoice] {
        let pool = englishVoices()
        var used = Set<String>()
        var map: [String: AVSpeechSynthesisVoice] = [:]
        func take(_ flavor: AVSpeechSynthesisVoiceGender) -> AVSpeechSynthesisVoice? {
            if flavor != .unspecified,
               let match = pool.first(where: { $0.gender == flavor && !used.contains($0.identifier) }) {
                used.insert(match.identifier)
                return match
            }
            if let any = pool.first(where: { !used.contains($0.identifier) }) {
                used.insert(any.identifier)
                return any
            }
            // Ran out of distinct voices — reuse the best available.
            return pool.first
        }
        for k in keys {
            if let v = take(genderFlavor(forVoiceKey: k)) { map[k] = v }
        }
        return map
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": !AVSpeechSynthesisVoice.speechVoices().isEmpty])
    }

    @objc func listVoices(_ call: CAPPluginCall) {
        let voices = englishVoices().map { v -> [String: Any] in
            return [
                "identifier": v.identifier,
                "name": v.name,
                "language": v.language,
                "quality": qualityLabel(v.quality),
                "gender": genderString(v)
            ]
        }
        call.resolve(["voices": voices])
    }

    @objc func synthesizePodcast(_ call: CAPPluginCall) {
        guard let rawSegments = call.getArray("segments") as? [[String: Any]], !rawSegments.isEmpty else {
            call.reject("No segments provided.")
            return
        }

        // Normalize segments and resolve a distinct voice per distinct key.
        let segments: [(text: String, key: String)] = rawSegments.compactMap { seg in
            let text = (seg["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if text.isEmpty { return nil }
            let key = (seg["voice"] as? String) ?? "alloy"
            return (text, key)
        }
        guard !segments.isEmpty else {
            call.reject("All segments were empty.")
            return
        }
        let distinctKeys = Array(Set(segments.map { $0.key }))
        let voiceMap = pickVoices(for: distinctKeys)

        // Render off the main thread; the write callbacks are serialized per
        // utterance with a semaphore so every segment lands in one file in order.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            do {
                let url = try self.render(segments: segments, voiceMap: voiceMap)
                let data = try Data(contentsOf: url)
                let usedVoiceNames = Array(Set(voiceMap.values.map { $0.name })).sorted()
                DispatchQueue.main.async {
                    call.resolve([
                        "path": url.path,
                        "uri": url.absoluteString,
                        "audioBase64": data.base64EncodedString(),
                        "mimeType": "audio/mp4",
                        "usedVoices": usedVoiceNames
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("iOS voice synthesis failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // Synthesize every segment and append its audio buffers to a single m4a file.
    private func render(segments: [(text: String, key: String)],
                        voiceMap: [String: AVSpeechSynthesisVoice]) throws -> URL {
        let tmpDir = FileManager.default.temporaryDirectory
        let outURL = tmpDir.appendingPathComponent("idiampro-podcast-\(UUID().uuidString).m4a")
        try? FileManager.default.removeItem(at: outURL)

        var audioFile: AVAudioFile?
        var writeError: Error?
        var producedAnyAudio = false

        for segment in segments {
            let utterance = AVSpeechUtterance(string: segment.text)
            if let voice = voiceMap[segment.key] {
                utterance.voice = voice
            }
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate

            let semaphore = DispatchSemaphore(value: 0)
            synthesizer.write(utterance) { (buffer: AVAudioBuffer) in
                guard let pcm = buffer as? AVAudioPCMBuffer else { return }
                if pcm.frameLength == 0 {
                    // End-of-utterance marker.
                    semaphore.signal()
                    return
                }
                do {
                    if audioFile == nil {
                        // Encode to AAC/m4a; AVAudioFile converts the PCM buffers.
                        let settings: [String: Any] = [
                            AVFormatIDKey: kAudioFormatMPEG4AAC,
                            AVSampleRateKey: pcm.format.sampleRate,
                            AVNumberOfChannelsKey: pcm.format.channelCount
                        ]
                        audioFile = try AVAudioFile(forWriting: outURL, settings: settings)
                    }
                    try audioFile?.write(from: pcm)
                    producedAnyAudio = true
                } catch {
                    writeError = error
                    semaphore.signal()
                }
            }
            // Wait for this utterance to finish before starting the next so the
            // segments stay in order in the single output file.
            semaphore.wait()
            if let err = writeError { throw err }
        }

        // Release the file handle so the finished m4a is readable.
        audioFile = nil
        guard producedAnyAudio, FileManager.default.fileExists(atPath: outURL.path) else {
            throw NSError(domain: "NativeTts", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "No audio was produced."])
        }
        return outURL
    }
}
