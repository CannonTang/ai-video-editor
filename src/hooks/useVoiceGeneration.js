import { useCallback } from "react";
import { isModelDownloadError } from "../lib/modelSources.js";
import { isPiperSymbolError, isStorageQuotaError, TtsInputError } from "../lib/ttsText.js";
import { applyVoiceOutputGain, convertVoiceBlob } from "../lib/openVoiceRuntime.js";
import { synthesizeBaseVoice } from "../lib/baseVoiceSynthesis.js";

export function useVoiceGeneration(d) {
  return useCallback(async (captionSegment = null) => {
    const rawText = (captionSegment?.text ?? d.script).trim();
    if (!rawText || d.status === "generating" || d.status === "captioning") return;
    d.setVoiceTab("synthesis"); d.setStatus("generating"); d.setStatusText("ttsStatusPreparingModel"); d.setProgress(6);
    try {
      let { blob } = await synthesizeBaseVoice({
        voice: d.selectedVoice, text: rawText, speed: d.speed, notify: d.notify, t: d.t,
        onStatus: d.setStatusText,
        onProgress: (value) => d.setProgress((current) => Math.max(current, Math.min(88, Math.max(10, Math.round(value * 0.78 + 10))))),
      });
      if (d.selectedVoiceProfile?.embedding) {
        d.setStatusText(d.t("cloneStageTwo", "第 2 步：转换为克隆音色"));
        d.setProgress(0);
        blob = await convertVoiceBlob(blob, d.selectedVoiceProfile.embedding, {
          seed: 2026,
          onProgress: (event) => {
            d.setStatusText(event.phase || d.t("cloneStageTwo", "第 2 步：转换为克隆音色"));
            if (Number.isFinite(event.progress)) d.setProgress(Math.max(1, Math.min(96, Math.round(event.progress))));
          },
        });
      }
      blob = await applyVoiceOutputGain(blob, d.volume);
      d.setStatusText("ttsStatusDecodingWaveform");
      d.setProgress((current) => Math.max(current, 96));
      await d.commitAudio(blob, `${d.selectedVoice.name} · ${d.t("ttsGenerated")}`, {
        captionSegment,
        script: rawText,
        sourceKind: d.selectedVoiceProfile ? "cloned-voiceover" : "ai-voiceover",
        cloneVoiceProfileId: d.selectedVoiceProfile?.id || "",
        cloneVoiceProfileName: d.selectedVoiceProfile?.name || "",
      });
      d.notify(d.t("ttsNoticeGenerated"));
    } catch (error) {
      console.error(error);
      const message = error instanceof TtsInputError ? d.t(error.code)
        : d.selectedVoice.engine === "piper" && isPiperSymbolError(error) ? d.t("ttsErrorUnsupportedPiperSymbols")
          : isStorageQuotaError(error) ? d.t("ttsErrorStorageQuota")
            : isModelDownloadError(error) ? d.t("ttsErrorModelDownload")
              : error instanceof Error ? error.message : d.t("ttsErrorGenerationFailed");
      d.setStatus("error"); d.setStatusText(message); d.setProgress(0); d.notify(message);
    }
  }, [d]);
}
