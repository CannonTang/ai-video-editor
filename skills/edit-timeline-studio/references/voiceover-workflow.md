# Agent-driven pre-voiceover

Use this workflow whenever an Agent generates narration before picture timing, including automatic edits, website promotions, localized versions, and caption-led videos.

## Default to warm storytelling

- Unless the user specifies another character, select the warmest natural storyteller-like voice among the available owned, pinned speakers. Favor a close, conversational presence, relaxed articulation, gentle confidence, and emotional warmth over a formal announcer, cold assistant, or neutral system voice.
- Direct and synthesize at the phrase level rather than as isolated words. Preserve natural breath space, vary pauses by meaning, use restrained pitch and energy movement, and place subtle emphasis on the important idea in each sentence. Do not add exaggerated acting, sing-song prosody, artificial breath sounds, or heavy pitch/formant processing merely to simulate warmth.
- Treat voice identity and delivery as separate choices. A suitable speaker can still sound mechanical when speed, pauses, or emphasis are flat; revise synthesis controls, punctuation, phrase breaks, or speaker choice until the performance reads as a person telling the story.
- Audition the actual rendered narration at normal speed. Reject metallic or buzzy timbre, robotic word-by-word cadence, flat sentence endings, identical pause lengths, abrupt joins, or an emotionally blank read. Regenerate before picture lock; EQ, reverb, music, or loudness processing must never be used to hide an unsuitable mechanical base performance.

## Route Chinese and English correctly

- Use MeloTTS `ZH` as the base speech engine when one narration contains both Chinese and inline English. Preserve the mixed-language script as one linguistic utterance; do not split it into Chinese and English clips merely to route different engines.
- Keep product names, acronyms, numbers, URLs, and intended English phrases verbatim unless the user supplies a pronunciation override. Listen to the rendered result and revise pronunciation text explicitly when necessary.
- Do not claim that Chinese-and-English mixed narration is ready until `node scripts/setup-host.mjs --check --capability voiceover` passes and the approved pinned model artifacts are locally available.
- If the environment is missing, show the exact plan from the doctor and obtain explicit approval before `--install --capability voiceover`. Never install dependencies as a side effect of the first synthesis request.
- For other languages, use the confirmed owned voice route selected by the brief. Do not silently route unsupported text through MeloTTS or an operating-system voice.

## Generate before editing picture

1. Confirm narration language and any explicitly requested speaker or presentation. When delivery style is unspecified, apply the warm storyteller default without blocking progress.
2. Normalize the final script without erasing intentional code-switching.
3. Generate natural-speed base speech. When a saved authorized clone profile is selected, run OpenVoice V2 timbre conversion only after MeloTTS base synthesis and retain both stage states for retry and error reporting.
4. Listen to the complete output for warmth, human storytelling cadence, phrase emphasis, pronunciation, pauses, clipping, noise tails, and loudness. Regenerate, change the owned speaker, or revise synthesis phrasing when the result sounds mechanical; revise the script rather than globally accelerating speech to force a target duration.
5. Split accepted narration into sentence-scoped audio artifacts, then bind each caption to exactly one matching `audioClipId`.
6. Measure accepted speech and use its clauses and pauses to set scene timing, motion, emphasis, and caption boundaries.

Keep runtime, model ID, immutable revision, speaker ID, language mode, text-normalization decisions, speed, timestamps, and fallback provenance with the generated asset.

## Gate sentence-to-sentence loudness

- Do not master short sentence clips independently with a single one-pass loudness-normalization filter and assume that matching settings produce matching perceived level. Short-clip gating can leave materially different integrated loudness and is a known cause of narration that sounds alternately loud and quiet.
- Run all sentence clips through one shared speech-mastering chain. Use gentle speech compression or equivalent transparent level control first, then measured gain or two-pass loudness normalization. Preserve natural emphasis and pauses; do not flatten consonants, pump room noise, or raise silence between words.
- Unless the delivery brief specifies another standard, target each accepted narration clip at `-18 LUFS` integrated with true peak at or below `-2 dBTP`. After processing, the loudest and quietest sentence clips must be within `1 LU` of each other. Keep sentence LRA at or below `5 LU` unless an intentional dramatic exception is documented and auditioned.
- Measure every physical sentence artifact after fades, sample-rate conversion, voice conversion, and gain changes. For clips too short for reliable gated LUFS, compare active-speech RMS or short-term loudness against adjacent sentences as a secondary check.
- Run `node scripts/validate-voiceover-loudness.mjs <sentence-01.wav> <sentence-02.wav> ...` on the final sentence artifacts. Treat a nonzero exit as a delivery blocker; change the command thresholds only when the brief documents another mastering standard.
- Measure the final mixed export over every narration interval as well as the full program. A compliant full-program average never excuses a sentence that jumps in level. Verify that music ducking, limiters, and clip overlaps do not reintroduce audible level changes.
- Reject delivery when any sentence misses the level-spread or true-peak gate, or when normal-speed continuous playback still reveals an unexplained loudness jump. Fix the individual stems, rebuild the editable project, and rerender before handoff.

## Gate stereo and multichannel timing

- Treat channel timing as part of clip timing. A narration clip scheduled later in the program must be silent on every channel before its start; do not validate only the left channel or a downmix.
- FFmpeg `adelay` defaults to `all=false`. For stereo or multichannel material, use `adelay=<milliseconds>:all=1` when every channel shares the same offset, or provide an explicit delay value for each channel. Never use a lone `adelay=<milliseconds>` value on multichannel speech.
- Build and inspect the isolated speech bus before music is mixed in. Compare per-channel activity at the opening and immediately before and after every scheduled speech boundary. Reject any later sentence audible at time zero, multiple sentences stacked in one ear, or undocumented left/right onset skew.
- Run `node scripts/validate-audio-channel-timing.mjs <mix.wav>` on the rendered narration mix. Use repeated `--window <start>:<duration>` arguments to cover the opening and other expected quiet windows. Treat a nonzero exit as a delivery blocker unless the brief explicitly documents intentional asymmetric audio.
- After the final music mix and encode, repeat the opening-window check on the delivery file and listen on headphones. A structurally correct timeline does not excuse a channel-routing defect introduced by the render graph.
