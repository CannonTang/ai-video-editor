import { useCallback } from "react";
import { isBuiltInPinyinVoice, predictPiperVoice } from "../lib/piperVoiceRuntime.js";
import { clearKokoroVoiceCacheIfStorageTight, predictKokoroVoice } from "../lib/kokoroVoiceRuntime.js";
import { predictMmsVoice } from "../lib/mmsVoiceRuntime.js";
import { isModelDownloadError } from "../lib/modelSources.js";
import { clearPiperCacheIfStorageTight, isPiperSymbolError, isStorageQuotaError, prepareTextForVoice, TtsInputError } from "../lib/ttsText.js";

export function useVoiceGeneration(d) {
  return useCallback(async (captionSegment = null) => {
    const rawText = (captionSegment?.text ?? d.script).trim();
    if (!rawText || d.status === "generating" || d.status === "captioning") return;
    let prepared;
    try { prepared = prepareTextForVoice(rawText, d.selectedVoice); }
    catch (error) {
      const message = error instanceof TtsInputError ? d.t(error.code) : error instanceof Error ? error.message : d.t("ttsErrorVoiceMismatch");
      d.setStatus("error"); d.setStatusText(message); d.setProgress(0); d.notify(message); return;
    }
    d.setVoiceTab("synthesis"); d.setStatus("generating"); d.setStatusText("ttsStatusPreparingModel"); d.setProgress(6);
    if (prepared.warningKey) d.notify(d.t(prepared.warningKey));
    try {
      let blob;
      if (d.selectedVoice.engine === "piper") {
        // Xiao Ya and Chaowen use our dedicated ONNX runtime. Avoid loading the
        // separate vits-web bundle on their first run; it is only needed by the
        // remaining Piper catalog voices.
        const builtInPinyinVoice = isBuiltInPinyinVoice(d.selectedVoice.id);
        const tts = builtInPinyinVoice ? null : await import("@diffusionstudio/vits-web");
        if (tts && await clearPiperCacheIfStorageTight(tts, d.selectedVoice.id)) d.notify(d.t("ttsNoticePiperCacheCleared"));
        d.setStatusText(d.selectedVoice.language === "中文"
          ? "ttsStatusLoadingChineseModel"
          : "ttsStatusPreparingModel");
        const progress = (event) => {
          if (event?.phase === "initializing") d.setStatusText("ttsStatusInitializingModel");
          if (event?.phase === "generating" || event?.backend) d.setStatusText(event.backend === "webgpu" ? "ttsStatusGeneratingWebGpu" : "ttsStatusGeneratingWasm");
          if (event?.total) {
            d.setProgress((current) => Math.max(
              current,
              Math.min(88, Math.max(12, Math.round((event.loaded / event.total) * 76))),
            ));
          }
        };
        const input = { text: prepared.text, voiceId: d.selectedVoice.id };
        try { blob = await predictPiperVoice(tts, input, progress); }
        catch (error) {
          if (!isStorageQuotaError(error)) throw error;
          d.setStatusText("ttsStatusClearingCache"); await tts?.flush?.(); blob = await predictPiperVoice(tts, input, progress);
        }
      } else if (d.selectedVoice.engine === "mms") {
        d.setStatusText("ttsStatusPreparingModel");
        blob = await predictMmsVoice({ text: prepared.text, voiceId: d.selectedVoice.id }, (event) => {
          if (event?.backend) d.setStatusText("ttsStatusGeneratingWasm");
          if (Number.isFinite(event?.progress)) d.setProgress((current) => Math.max(current, Math.min(86, Math.round(event.progress))));
        });
      } else if (d.selectedVoice.engine === "supertonic") {
        d.setStatusText("ttsStatusPreparingModel");
        const { predictSupertonicVoice } = await import("../lib/supertonicVoiceRuntime.js");
        blob = await predictSupertonicVoice({ text: prepared.text, speed: d.speed }, (event) => {
          if (event?.backend) d.setStatusText("ttsStatusGeneratingWasm");
          if (Number.isFinite(event?.progress)) d.setProgress((current) => Math.max(current, Math.min(86, Math.round(event.progress))));
        });
      } else {
        d.setStatusText("ttsStatusLoadingKokoro");
        await clearKokoroVoiceCacheIfStorageTight();
        blob = await predictKokoroVoice({
          text: prepared.text,
          voiceId: d.selectedVoice.id,
          speed: d.speed,
        }, (event) => {
          if (event?.backend) d.setStatusText("ttsStatusGeneratingWasm");
          if (Number.isFinite(event?.progress)) d.setProgress((current) => Math.max(
            current,
            Math.min(92, Math.max(10, Math.round(event.progress))),
          ));
        });
      }
      d.setStatusText("ttsStatusDecodingWaveform");
      d.setProgress((current) => Math.max(current, 96));
      await d.commitAudio(blob, `${d.selectedVoice.name} · ${d.t("ttsGenerated")}`, {
        captionSegment,
        script: rawText,
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
