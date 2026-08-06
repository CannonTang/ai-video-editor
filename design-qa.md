# Mobile music-library loading layout QA

- Source visual truth: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-124e8035-c4d0-46bd-abb9-4d930183c48d.png`
- Implementation screenshot: `/private/tmp/web-player-mobile-library-loading-fixed.png`
- Combined comparison: `/private/tmp/web-player-mobile-library-loading-comparison.jpg`
- Viewport: 412 × 915 CSS px, device scale factor 1
- Source pixels: 844 × 920; implementation pixels: 412 × 915
- Normalization: compared the app-owned mobile sheet and the two-column loading grid at their rendered sizes; surrounding crop and the source screenshot's unknown capture density were excluded from spacing judgments.
- State: Media → Library → Music, active search request, library loading skeletons visible.

## Full-view comparison evidence

The source showed the AI Music card overlapping a nested two-column skeleton grid: the first visible skeleton began lower than the AI card and the next skeleton row started before the AI card's row had ended. In the revised 412 × 915 capture, AI Music and the first skeleton share the exact top coordinate (464.5 px), while the next skeleton row begins at 628.875 px after the first row ends.

## Focused region comparison evidence

The card grid was inspected directly because it is the affected region. The AI Music card and first skeleton both measure 175 px wide and align at the same first-row top. Subsequent skeletons occupy the left and right columns at the same second-row top. No overlap remains.

## Required fidelity surfaces

- Fonts and typography: unchanged; card titles, hints, search input, and provider label retain the existing mobile type hierarchy and truncation.
- Spacing and layout rhythm: passed; the loading state now uses one grid formatting context with 10 px column/row gaps and aligned rows.
- Colors and visual tokens: unchanged; existing dark surfaces, cyan selection, blue AI Music styling, and skeleton tokens are preserved.
- Image quality and asset fidelity: unchanged; the existing AI Music artwork and skeleton shimmer are reused without replacement or scaling artifacts.
- Copy and content: unchanged; localized labels and provider attribution are preserved.

## Comparison history

1. P1 — Loading skeletons overlapped the AI Music card because the skeleton container spanned both columns inside an outer grid that already contained the prepended AI card.
2. Fix — Rendered skeleton cards as direct children of the asset grid and moved `aria-busy`/loading labeling to that grid.
3. Post-fix evidence — The first-row cards align at 464.5 px, the second row starts at 628.875 px, and the 412 × 915 browser capture shows no overlap or clipped card content.

## Interaction and runtime checks

- Tested opening Media, switching to Library, selecting Music, and changing the search query to trigger loading.
- Browser console errors: none.
- Focused region was sufficient because the change is isolated to the library grid; unrelated editor regions were intentionally left unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the reported loading-layout defect.

final result: passed

---

**Design QA — clone profiles in the synthesis picker**

- source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-c04d636e-4b62-432d-9825-8554be402d01.png`
- implementation screenshot path: `/private/tmp/web-player-clone-picker.jpg`
- full comparison path: `/private/tmp/clone-picker-comparison.jpg`
- focused comparison path: `/private/tmp/clone-picker-focused-comparison.jpg`
- source pixels: 816 × 958; implementation pixels: 1280 × 720 at deviceScaleFactor 1
- density normalization: source and implementation were proportionally scaled to a common 720 px comparison height; focused picker regions were separately cropped and scaled to 600 px height
- state: Chinese dark desktop editor, Audio → Voice synthesis, saved clone selected, Chinese base language, output gain 120%

**Evidence and required fidelity surfaces**

- Full view: the existing editor composition, right-inspector width, tab hierarchy, two-column voice grid, timeline density, and cyan selection language are preserved.
- Focused view: the saved clone appears as the first selectable voice card, uses the same card anatomy as built-in voices, carries a distinct Clone badge/avatar treatment, and leaves the selected built-in source visible as “Base language voice”.
- Typography: the app font stack, weights, sizes, and one-line card hierarchy are unchanged; long profile names are now ellipsized instead of creating tall multi-line cards.
- Spacing/layout: the clone card occupies one normal grid cell and does not introduce a separate banner or alter the two-column rhythm.
- Colors/tokens: the clone card reuses the existing blue/cyan voice palette with a slightly differentiated surface; contrast remains consistent with neighboring cards.
- Assets: existing Phosphor voice icons are reused; no supplied image asset was replaced or approximated.
- Copy/content: “Multilingual · cloned voice”, “Clone”, the base-language source, 120% default gain, and limiter protection are explicit.

**Interaction evidence**

- Selected a persisted IndexedDB clone directly from the synthesis picker; its stored test sample became the sample player source.
- Switched the language filter from Chinese to English while preserving the clone target; the base voice changed from Xiao Ya to Heart.
- Completed a real English base-TTS → OpenVoice clone conversion (3.16 s output).
- Completed a real Chinese base-TTS → OpenVoice clone conversion (3.41 s output).
- Verified clone selection changes an untouched 100% gain to 120%; the synthesis slider exposes 0–400% and high gain shows limiter-protection copy.
- Production build and `git diff --check` passed.

**Comparison history and findings**

- Pass 1 found a P2: a long uploaded profile filename wrapped into three lines and disrupted the compact voice-card rhythm.
- Fix: constrained the card copy column and applied one-line ellipsis to title and metadata.
- Pass 2 focused comparison shows the clone card aligned with the built-in card height; no actionable P0/P1/P2 findings remain.
- P3: the implementation screenshot uses a narrower inspector viewport than the supplied crop, so less metadata is visible before ellipsis; this is expected responsive behavior.

final result: passed

---

## Clone voice naming and recording-route QA

- source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-2ae39b93-1557-41a8-bf64-79cd64a496d3.png`
- implementation screenshot path: `/private/tmp/web-player-clone-voice-tab.png`
- combined comparison path: `/private/tmp/clone-voice-tab-comparison.png`
- viewport: 1280 × 720 CSS px, deviceScaleFactor 1
- source pixels: 892 × 334; implementation pixels: 1280 × 720
- normalization: compared the complete source crop with a proportionally fit crop of the implementation's right AI Voice inspector
- state: Chinese desktop editor, Audio workspace, Clone voice tab selected, one saved clone profile

### Full-view and focused comparison evidence

The implementation keeps the source tab order, typography, cyan active underline, dark surfaces, status pill, and two-card anatomy. The requested terminology change is limited to the second tab (`克隆声音`). The focused inspector view adds clearer route copy without changing the reference hierarchy: `录制参考声音` and `上传声音` are parallel entry cards, and saved profiles remain below them.

### Required fidelity surfaces

- Fonts and typography: existing application font stack, weights, sizes, truncation, and hierarchy are preserved.
- Spacing and layout rhythm: tab spacing, underline, two-column cards, borders, radii, and section gaps match the existing inspector.
- Colors and visual tokens: existing cyan action/selection, muted metadata, and dark layered surfaces are unchanged.
- Image quality and assets: existing Phosphor microphone and upload icons are reused; no raster or custom-drawn substitutes were introduced.
- Copy and content: `我的声音` is replaced by `克隆声音`; recording explicitly enters clone testing and does not imply timeline insertion.

### Primary interactions and runtime checks

- Opened Audio and selected the renamed Clone voice tab.
- Verified Record reference voice and Upload voice are presented as equivalent enrollment sources.
- Verified an existing saved clone profile remains usable/favoritable/deletable.
- Microphone capture itself was not invoked during QA because accepting device permission requires user action; the recorder completion handler was changed to create a clone-test candidate without calling timeline audio replacement.
- Production build passed; no new browser application errors were observed in the rendered naming/layout state.

### Comparison history and findings

- Initial request: `我的声音` described storage rather than the creation task and the recorder previously committed directly to the voiceover track.
- Fix: renamed the localized tab across all supported UI languages, changed the recorder to create and auto-select a reference candidate, and kept timeline insertion exclusively for completed generated voiceovers.
- No actionable P0/P1/P2 visual findings remain.

final result: passed

---

**Design QA — browser voice cloning**

- source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-21e1f440-41bd-43c7-849f-dddb8ae1fcf7.png`
- implementation screenshot path: `/private/tmp/web-player-my-voices-fixed-2048.png`
- combined comparison path: `/private/tmp/voice-design-comparison-2048.png`
- source pixels: 840 × 772 (cropped desktop reference, density not declared)
- implementation pixels: 2048 × 1057 at a 2048 × 1057 CSS viewport and deviceScaleFactor 1
- density normalization: the right inspector was cropped from the implementation and both inspector crops were proportionally fit to a common 650 px comparison height; no density-only differences were filed
- state: Chinese, dark desktop editor, Audio → My voices, one saved clone profile

**Full-view comparison evidence**

The implementation preserves the reference hierarchy, dark surface palette, cyan active-tab treatment, bordered recording surface, compact status badge, typography weight progression, radii, and restrained elevation. The intentional product changes are visible without changing the established visual language: Favorites is now a separate top-level tab, Upload voice is paired with Record voice, and successfully tested clone profiles appear under Saved clone voices.

**Focused region comparison evidence**

The combined inspector comparison checks the tab row, recording/upload entry cards, cyan primary action, section label, empty/saved profile region, text contrast, and border treatments. The four-tab row remains readable at the target desktop viewport. The saved profile row keeps all Use/Favorite/Delete actions inside the inspector bounds (rightmost action ends at x=1998 within the 2048 px viewport).

**Required fidelity surfaces**

- Fonts and typography: existing application font stack and weights are reused; title, tab, card-title, helper, and metadata hierarchy remain consistent. No unexpected wrapping or truncation was observed at the target viewport.
- Spacing and layout rhythm: inspector padding, section gaps, radii, card spacing, and cyan active underline match the reference family. Two equal source cards are an intentional functional expansion.
- Colors and visual tokens: existing near-black surfaces, muted gray copy, translucent cyan borders, and cyan primary action tokens are reused.
- Image quality and assets: no reference image assets were replaced. Existing Phosphor microphone/upload icons remain sharp vector assets.
- Copy and content: Upload/Record, authorization, clone test, explicit save, saved profiles, Favorites, and removal behavior are represented with direct localized copy.

**Interaction evidence**

- Uploaded a repository voice sample through the real file chooser.
- Confirmed authorization gating keeps Test clone disabled until checked.
- Ran OpenVoice reference encoding and clone conversion in the browser.
- Listened-state UI enabled explicit Save to My voices.
- Saved a profile to IndexedDB, reloaded the page, and confirmed it persisted.
- Favorited and unfavorited the clone; confirmed unfavoriting did not delete the profile.
- Selected the saved profile, ran base TTS → clone conversion, and confirmed a 2.96 s waveform was committed to the voiceover track.
- Checked browser console output: no application exceptions after the fix; ONNX Runtime emitted only its expected execution-provider assignment warnings.

**Comparison history**

- Pass 1: a 1280 × 720 implementation capture made the inspector appear materially denser than the cropped source. This was a viewport/state mismatch, not a layout defect.
- Normalization: recaptured at the user's 2048 × 1057 desktop viewport and compared focused inspector crops. The earlier apparent density mismatch was resolved; no actionable P0/P1/P2 visual difference remained.
- Pass 2: the live clone-loading state exposed a P2 layout defect: the status copy was placed in the spinner's 18 px grid column and rendered vertically.
- Fix: restored the loading component's spinner node and explicitly defined `18px minmax(0, 1fr) auto` columns. The post-fix enrollment/试听 capture keeps reference audio, authorization copy, A/B result, and actions aligned within the inspector.

**Findings**

- No actionable P0/P1/P2 visual findings.
- P3: very long uploaded filenames are ellipsized in the profile metadata; this is acceptable and preserves action visibility.

**Implementation checklist**

- [x] Reference visual and implementation opened and combined for comparison
- [x] Desktop target viewport verified
- [x] Empty, enrollment, saved, favorite, and generated states exercised
- [x] Typography, spacing, colors, assets, and copy checked
- [x] Console errors checked

final result: passed
## 2026-08-06 — Selected audio Voice color inspector

- Reference: `codex-clipboard-28445ec8-937b-476e-a891-397db4810b4f.png`.
- Implementation evidence: `/private/tmp/web-player-voice-color-showcase.png` at the desktop editor viewport.
- Layout check: PASS. Audio, Fades, and Voice color render on one row as three equal 89 px tabs; no wrapping or clipped labels.
- Hierarchy check: PASS. The selected clip identity remains first, source audio and target timbre are separated into compact cards, saved target voices are direct-select cards instead of a redundant placeholder dropdown, and conversion actions no longer collide with the inspector's download/delete controls.
- Functional check: PASS. A cached Chinese base voice was generated, converted with a saved OpenVoice profile, automatically saved to My assets, explicitly applied to the selected clip, and restored to the original audio.
- Localization check: PASS. The Voice color surface and status/action copy are present in all 11 supported interface locales; enrollment test sentences cover all 12 catalog voice languages.
- Responsive check: PASS by structure. Desktop keeps the three peer tabs; mobile continues to open Voice color as its own focused single-purpose drawer, consistent with the established mobile inspector contract.
