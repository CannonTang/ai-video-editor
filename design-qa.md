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

## 2026-08-08 — Unified glass Tab hover

- Source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-de47cc56-e426-44c1-82c8-9c1cf7b4e53c.png`
- Implementation screenshot path: `/private/tmp/timeline-tabs-final-glass-hover.png`
- Focused implementation path: `/private/tmp/timeline-tabs-final-glass-hover-close.png`
- Combined comparison path: `/private/tmp/timeline-tabs-glass-hover-comparison.png`
- Viewport: 1280 × 720 CSS px, device scale factor 1
- Source pixels: 956 × 462; implementation pixels: 1280 × 720
- Normalization: compared the source AI Voice inspector crop and the browser-rendered inspector crop at a shared 375 px height.
- State: Chinese desktop editor, Audio → AI Voice, Voice synthesis selected, Favorite voices hovered.

### Full-view and focused comparison evidence

The first implementation used a bright rectangular border and filled panel behind the hovered tab, which visually competed with the active cyan underline and read as a second selected state. The revised browser capture removes the border, elevation, and full-tab fill. Hover now brightens the label and runs one compact, blurred reflection behind it; the active tab remains the only state with the cyan underline.

### Required fidelity surfaces

- Fonts and typography: existing family, size, weight, alignment, truncation, and four-tab rhythm are unchanged; hover adds only a restrained text glow.
- Spacing and layout rhythm: tab widths, header spacing, divider position, and inspector density are unchanged; hover does not translate or resize the control.
- Colors and visual tokens: the dark surface and cyan selected state are preserved. Hover uses a low-opacity neutral-cyan reflection without a competing border or filled card.
- Image quality and assets: no image or icon asset changed; the interaction is rendered with the existing UI surface.
- Copy and content: tab labels, ordering, status pill, and panel content are unchanged.

### Interaction and runtime checks

- Hovered AI Voice, Caption, Media Library, segmented Audio-property, and Visual-property tab families through the shared selector set.
- Confirmed selected tabs retain their original active treatment and do not receive the hover reflection.
- Confirmed `prefers-reduced-motion` suppresses reflection travel while retaining a visible focus state.
- Browser console errors and warnings: none.
- `npm run build`: passed.
- `git diff --check -- src/styles.css`: passed.

### Comparison history and findings

1. P2 — Hover looked like a second selected state because it used a bright outline, translucent block fill, elevation, and vertical lift.
2. Fix — Removed hover border, lift, outer shadow, and full-tab glass panel; constrained the reflection to a short blurred band behind the label.
3. Post-fix evidence — The focused comparison shows no box around `收藏声音`; `语音合成` remains the sole selected tab through its cyan underline.

No actionable P0, P1, or P2 differences remain for the requested hover correction.

final result: passed

---

## 2026-08-08 — Export popover close-icon centering correction

- Source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-77d0a601-92c4-452a-9e12-ede7b531f2f2.png`
- Pre-fix implementation screenshot path: `/private/tmp/export-close-before.png`
- Post-fix implementation screenshot path: `/private/tmp/export-close-after-hover.png`
- Combined focused comparison path: `/private/tmp/export-close-comparison.png`
- Browser viewport: 782 × 814 CSS px, devicePixelRatio 2
- Source pixels: 1146 × 1192; post-fix browser capture: 767 × 799
- Density normalization: the source close-control region was cropped to 144 × 144 and downsampled to 48 × 48; the implementation hover region was cropped at 48 × 48. The two equal-size crops were compared side by side.
- State: Chinese desktop editor, Export settings popover open, close control hovered.

### Full-view and focused comparison evidence

The full browser capture confirms the export popover position, fields, typography, color tokens, and surrounding top bar remain unchanged. The focused comparison isolates the only requested surface: the source screenshot shows the close mark shifted to the right inside its highlighted button, while the post-fix button keeps the mark centered in the same hover treatment.

### Required fidelity surfaces

- Fonts and typography: unchanged; no text or font metrics were modified.
- Spacing and layout rhythm: the 24 × 24 close button, popover offsets, field layout, padding, and radii are unchanged.
- Colors and visual tokens: the existing resting and hovered glass treatments are unchanged.
- Image quality and assets: the existing Phosphor `X` remains the source icon; no custom SVG, glyph, or raster replacement was introduced.
- Copy and content: export labels, values, and accessible close label are unchanged.

### Interaction and runtime checks

- Opened Export settings in the in-app browser.
- Before the fix, computed geometry measured the 14 × 14 SVG center at `+2px` horizontally from the 24 × 24 button center; computed padding was `1px 6px`.
- Added `padding: 0` to `.popover-close`.
- After the fix, both resting and hovered states measure `delta x: 0`, `delta y: 0`.
- Clicked Close and confirmed the export popover disappeared, then reopened it successfully.
- Browser console errors: none.
- `npm run build`: passed.
- `npm run lint -- --quiet`: passed.

### Comparison history and findings

- Pass 1 finding (P2): the earlier mobile-sheet verification did not cover the shared popover close control. Native button padding reduced the grid content box below the SVG width, causing the SVG to overflow two pixels to the right.
- Fix: explicitly reset `.popover-close` padding to zero while preserving its dimensions and visual states.
- Pass 2 evidence: DOM geometry is exactly centered at rest and on hover, and the normalized focused comparison shows no remaining actionable P0/P1/P2 difference.

This section supersedes the earlier broad claim that all close controls had been verified; that earlier pass only proved the mobile-sheet close button.

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

---

## 2026-08-08 — Mobile close-icon visual centering

- Source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-ceefc0fc-a1ea-4bdd-8ff3-bc0e82efa5be.png`
- Implementation screenshot path: `/private/tmp/implementation-close-centered.png`
- Combined focused comparison path: `/private/tmp/close-center-comparison.png`
- Viewport: 390 × 844 CSS px, device scale factor 1
- Source pixels: 260 × 180; implementation pixels: 390 × 844
- Density normalization: the 70 × 70 source and implementation close-control regions were cropped at their native pixel density and placed side by side without scaling.
- State: Chinese mobile editor, Media bottom sheet open, Tools tab selected.

### Full-view and focused comparison evidence

The full mobile capture confirms the bottom sheet, header, tabs, and navigation remain unchanged. The focused side-by-side comparison shows the original font `×` with a visibly right-weighted glyph and the revised Phosphor `X` with balanced strokes. Browser geometry measured the 34 × 34 button center and 20 × 20 icon center at the same point (`delta x: 0`, `delta y: 0`). A focused crop is sufficient for the only requested change because no surrounding layout, typography, color, image, or copy was modified.

### Required fidelity surfaces

- Fonts and typography: unchanged; the close control no longer depends on font glyph metrics.
- Spacing and layout rhythm: the 34 × 34 button size, header height, padding, and responsive placement are unchanged.
- Colors and visual tokens: existing close-control color and surface treatment are unchanged.
- Image quality and assets: the existing Phosphor icon library supplies the close icon; no custom SVG, glyph substitute, or raster asset was introduced.
- Copy and content: labels and visible application copy are unchanged; the accessible close label remains localized.

### Interaction and runtime checks

- Opened Media at the 390 × 844 mobile breakpoint.
- Confirmed the close button contains a 20 × 20 SVG centered exactly within its 34 × 34 box.
- Clicked the close control and confirmed the sheet closed (`closeStillVisible: false`).
- Browser console errors: none.
- `npm run build`: passed.
- `npm run lint -- --quiet`: passed.

### Comparison history and findings

- Pass 1 finding (P2): the font-rendered `×` appeared visually shifted right despite the button's grid centering.
- Fix: replaced glyph-based close controls with the shared Phosphor `X` component and explicitly retained grid centering for the mobile sheet close button.
- Pass 2 evidence: icon and button centers match at zero-pixel delta; no actionable P0/P1/P2 mismatch remains.

final result: passed

---

## 2026-08-08 — Unified segmented Tab system

- Source visual truth paths:
  - `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-a57a5477-275c-4071-b616-97ac03abdc08.png`
  - `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-d2c1a938-b18e-4862-b54c-6f70983d9861.png`
  - `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-834a30d6-f016-4985-8137-83e2b41fdd8c.png`
- Desktop implementation screenshot: `/private/tmp/timeline-tabs-final-unified-caption.png`
- Persistent hover screenshot: `/private/tmp/timeline-tabs-final-inactive-hover-glass.png`
- Mobile implementation screenshot: `/private/tmp/timeline-tabs-unified-mobile.png`
- Focused comparison: `/private/tmp/timeline-tabs-media-caption-final-comparison.png`
- Viewports: 1280 × 720 desktop and 390 × 844 mobile, device scale factor 1
- Source pixels: 764 × 196 media reference and 520 × 858 glass reference; implementation pixels: 1280 × 720 and 390 × 844
- Normalization: the media reference and the rendered Caption inspector Tab row were cropped and scaled to a shared 180 px height; the existing rail-tool selected state was used as the glass-material reference.
- States: Media top navigation, Media type navigation, Caption position, Caption/AI Voice, AI Voice top navigation, Sticker categories, and mobile Tools/Properties.

### Full-view and focused comparison evidence

Every content-switching Tab now uses one recessed 44 px glass rail and 36 px selected pane. The selected pane matches the media reference and left tool rail through a deep cyan surface, 28% cyan border, restrained inner highlight, and no elevation jump. The focused comparison shows Caption/AI Voice using the same anatomy as Local upload/Library/My assets; differing pane widths are expected from two versus three equal columns.

### Required fidelity surfaces

- Fonts and typography: all covered Tab buttons resolve to 13 px, weight 650, and 15.6 px line height. Legacy Caption 700 weight and Visual/Audio 11–12 px overrides were normalized.
- Spacing and layout rhythm: all rails use 44 px minimum height, 4 px gap/padding, and 12 px radius; panes use 36 px height and 9 px radius. Caption position and Caption/AI Voice measured identically to Media.
- Colors and visual tokens: selected panes resolve to the same rgba background, border, text, and two inset shadows. Inactive hover retains a persistent lighter cyan glass surface after the moving reflection completes.
- Image quality and assets: no image, logo, illustration, or icon assets changed. Existing application icons remain intact.
- Copy and content: labels and ordering are unchanged across workspaces.

### Interaction and runtime checks

- Verified matching computed-style signatures for Media, Media type, Caption position, Caption/AI Voice, AI Voice, and Sticker category selected states.
- Verified inactive Caption hover after 650 ms: cyan glass background, 21% border, inner highlight, and 10 px backdrop blur remain visible.
- Added `cursor: pointer` to every unified Tab button and `cursor: not-allowed` to disabled states.
- Separated mobile Tools/Properties tabs from the Close button's tablist semantics; close interaction still dismisses the sheet.
- Browser console errors and warnings: none.
- `npm run build`: passed.
- `git diff --check -- src/styles.css src/App.jsx design-qa.md`: passed.

### Comparison history and findings

1. P2 — Several legacy selectors retained different heights, font sizes, weights, and hover surfaces, so visually similar Tab groups did not align.
2. Fix — Added one shared segmented Tab system, then normalized stronger Caption/Voice selectors to the same 44/36 geometry and 13/650 typography.
3. P2 — Caption's legacy hover rule removed the glass surface after the reflection passed, and some Tab buttons retained the default arrow cursor.
4. Fix — Locked persistent inactive glass hover tokens across the shared system and standardized pointer/disabled cursors.
5. Post-fix evidence — Media, Caption, Caption position, AI Voice, Media type, and Sticker selected states return identical computed style values; desktop and mobile captures show no clipping or layout shift.

No actionable P0, P1, or P2 findings remain.

final result: passed

---

## 2026-08-08 — Secondary action glass hover

- Source visual truth path: `/var/folders/l_/w_gfmzg94rs4qtwbtp3vj7hw0000gn/T/codex-clipboard-5529e72d-0bd1-4833-b50e-3e428eb0398b.png`
- Browser-rendered implementation screenshot: `/private/tmp/timeline-panel-secondary-glass-hover-v4.png`
- Focused side-by-side comparison: `/private/tmp/panel-secondary-glass-comparison.png`
- Viewport: 767 × 799 CSS px, device scale factor 1
- Source pixels: 862 × 334; implementation pixels: 767 × 799
- Normalization: the 618 × 76 source button region and rendered 584 × 48 secondary-action region were cropped and normalized to the same 618 × 76 comparison size.
- State: desktop dark theme; enabled `.panel-secondary` action after the pointer has rested over it for 650 ms.

### Full-view and focused comparison evidence

The full browser capture verifies the shared secondary action in its surrounding inspector/card context. The focused comparison places the reported flat “分析人物” rest state next to the revised hovered secondary action. The revision retains the original quiet dark geometry while adding a persistent cyan-tinted glass fill, restrained border, inner highlight, and soft backdrop blur; the state remains visible after the reflection sweep completes.

### Required fidelity surfaces

- Fonts and typography: control font size, weight, line height, alignment, and label treatment are unchanged; hover only lifts the text color slightly toward mint.
- Spacing and layout rhythm: button dimensions, padding, radius, and surrounding panel layout are unchanged; hover applies no positional lift or layout shift.
- Colors and visual tokens: hovered state resolves to `rgba(53, 234, 217, 0.067)` fill, `rgba(76, 238, 222, 0.22)` border, two restrained inset highlights, and `blur(10px) saturate(1.12)` backdrop filtering.
- Image quality and assets: no image, icon, or raster asset changed.
- Copy and content: no visible application copy changed.

### Interaction and runtime checks

- Verified the pointer genuinely intersects the enabled button (`:hover` is true), avoiding a false negative from an offscreen target.
- Verified computed `cursor: pointer` on the hovered action.
- Verified disabled buttons are excluded through `:not(:disabled)` and therefore do not receive the interactive glass treatment.
- Verified focus-visible shares the same persistent glass state for keyboard parity.
- Browser screenshot captured after 650 ms to confirm the glass remains after the moving highlight finishes.
- `npm run build`: passed.
- `npm run lint -- --quiet`: passed.
- `git diff --check -- src/styles.css src/App.jsx design-qa.md`: passed.

### Comparison history and findings

1. P2 — the reported enabled “分析人物” control remained visually flat on hover and did not communicate the shared glass interaction language.
2. Fix — added a reusable, spatially fixed glass hover/focus state to enabled `.panel-secondary` actions, including pointer cursor, clipped highlight, cyan border/fill, inner light, reduced-motion handling, and no hover lift.
3. Post-fix evidence — live computed styles and the focused comparison show the persistent glass surface; no actionable P0/P1/P2 mismatch remains.

final result: passed

---

## 2026-08-14 — Visual speed curve editor

- Source visual truth path: `/Users/yanghaixin/.codex/generated_images/019ffe2e-3594-78d1-bbea-db9301a2fb7c/exec-e51b9303-b84f-4994-b19d-5366a08ede75.png`, amended by the user's explicit instruction to remove the separate 匀速 / 渐快 / 渐慢 preset row.
- Implementation screenshot path: unavailable; the Codex in-app Browser repeatedly timed out while attaching or navigating to the running local Vite page.
- Intended viewport: 1440 × 1024 CSS px, device scale factor 1.
- Source pixels: 1536 × 1024. Implementation pixels: unavailable, so density normalization could not be performed.
- State: selected desktop video clip, 曲线 tab active, four default speed stages visible.

### Full-view and focused comparison evidence

The source visual was opened at original resolution. The right inspector and selected Visuals clip are the required focused regions. The implementation could not be captured, so neither a same-state full-view comparison nor a combined focused-region comparison was possible.

### Required fidelity surfaces

- Fonts and typography: blocked pending browser capture.
- Spacing and layout rhythm: blocked pending browser capture; panel height and clipping require direct evidence.
- Colors and visual tokens: code uses the existing charcoal/cyan tokens, but rendered fidelity remains blocked.
- Image quality and asset fidelity: no new raster assets were introduced; existing thumbnails are reused. Rendered sharpness remains blocked.
- Copy and content: localized Curve, stage, hint, add-stage, and smoothing copy is present; separate speed presets are intentionally absent.

### Interaction and runtime checks

- `npm run check`: passed.
- Variable-rate normalization, average-rate duration calculation, and monotonic source-progress mapping were exercised from the command line.
- Browser interaction checks pending: open 曲线, drag a node, double-click to add a stage, edit a stage rate, toggle smoothing, reset, verify timeline diamonds, and inspect console errors.

### Comparison history and findings

1. P1 — browser-rendered implementation evidence is missing because the in-app Browser could not attach to the local page even though the Vite server returns HTTP 200.
2. Required fix — reopen the running preview in the in-app Browser, capture the 1440 × 1024 state, exercise the primary interactions, and compare it with the amended source visual.

final result: blocked
