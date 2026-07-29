import { useCallback } from "react";
import { DEFAULT_VISION_OPTIONS, revokeVisionObjectUrls } from "../lib/editorRuntime.js";
import { analyzePersonOutlineVideo } from "../lib/personOutlineAnalysis.js";
import { analyzeVideoVisualTrack, analyzeVisualSubject, captureVisualFrame } from "../lib/vision.js";

function formatMessage(template, values = {}) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    String(template ?? ""),
  );
}

function effectPhaseKey(phase) {
  const text = String(phase ?? "");
  if (/光流|逐帧描边|optical flow/i.test(text)) return "effectPhaseTracking";
  if (/MediaPipe|SlimSAM|清理主体|完整人像锚点|不完整|refin/i.test(text)) return "effectPhaseRefining";
  if (/MODNet|抠图|透明|Alpha|matting/i.test(text)) return "effectPhaseMatting";
  if (/YOLOS|识别主体|已识别主体|未识别|detect/i.test(text)) return "effectPhaseDetecting";
  if (/模型|ONNX|下载|读取|解码|准备|初始化|已就绪|model|download|decod/i.test(text)) return "effectPhaseLoadingModels";
  return "effectAnalysisRunning";
}

function localizeEffectPhase(phase, t) {
  if (!phase || typeof t !== "function") return phase;
  const frameMatch = String(phase).match(/^(?:帧|逐帧描边)\s*(\d+)\/(\d+)\s*·\s*(.+)$/);
  const phaseKey = effectPhaseKey(phase);
  const localizedPhase = t(phaseKey);
  return frameMatch
    ? formatMessage(t("effectProcessedFrame"), {
        current: frameMatch[1],
        total: frameMatch[2],
        state: localizedPhase,
      })
    : localizedPhase;
}

export function useVisionAnalysis(deps) {
  return useCallback(async () => {
    const tr = (key, fallback) => deps.t?.(key, fallback) ?? fallback ?? key;
    if (!deps.previewVisualSrc || !deps.previewVisionKey) return void deps.notify(tr("effectSelectMediaFirst", "Add an image or video to the Visuals track first"));
    if (deps.visionJob.running && deps.visionJob.key === deps.previewVisionKey) {
      deps.visionJobGenerationRef.current += 1;
      deps.visionAbortControllerRef.current?.abort(); deps.visionAbortControllerRef.current = null;
      deps.setVisionJob({ running: false, key: deps.previewVisionKey, progress: 0, phase: tr("effectAnalysisCanceled", "Analysis canceled") });
      return void deps.notify(tr("effectAnalysisCanceledToast", "Canceled the current person analysis"));
    }
    deps.visionAbortControllerRef.current?.abort();
    const controller = new AbortController(); deps.visionAbortControllerRef.current = controller;
    const generation = deps.visionJobGenerationRef.current + 1;
    deps.visionJobGenerationRef.current = generation;
    const key = deps.previewVisionKey; const type = deps.previewVisualType;
    deps.setVisionJob({
      running: true,
      key,
      progress: 1,
      phase: type === "video"
        ? tr("effectPrepareVideo", "Preparing full-video analysis")
        : tr("effectCaptureFrame", "Capturing the current frame"),
    });
    try {
      const onProgress = ({ progress, phase }) => deps.setVisionJob((job) => job.key === key
        ? { ...job, progress: Math.max(job.progress, progress), phase: localizeEffectPhase(phase, deps.t) || job.phase } : job);
      const source = deps.previewVisualSegment?.blob || deps.previewVisualSrc;
      let analysis; let objectUrls = [];
      if (type === "video") {
        const duration = Math.max(
          0.05,
          Number(deps.previewVisualSegment?.duration)
            || Number(deps.previewVideoRef.current?.duration)
            || 0.05,
        );
        const partialSamples = [];
        const usePersonOutlinePipeline = deps.activeTool === "effects";
        const analyzeVideo = usePersonOutlinePipeline ? analyzePersonOutlineVideo : analyzeVideoVisualTrack;
        const result = await analyzeVideo({
          src: source,
          duration,
          ...(usePersonOutlinePipeline
            ? { flowFps: 8, anchorFps: 1 / 3.5, maxSamples: 360, maxDimension: 360 }
            : {
                includeMatting: true,
                fps: 2,
                maxSamples: 180,
                maxDimension: 512,
                threshold: 0.32,
                preferredLabels: ["person", "cat", "dog", "car", "bottle", "chair"],
              }),
          signal: controller.signal, onProgress,
          onSample: ({ sample, index, total, duration: sampleDuration, sourceSize }) => {
            if (controller.signal.aborted || generation !== deps.visionJobGenerationRef.current) return;
            const { cutoutBlob, ...serializableSample } = sample;
            const cutoutUrl = cutoutBlob ? URL.createObjectURL(cutoutBlob) : "";
            if (cutoutUrl) objectUrls.push(cutoutUrl);
            const committedSample = { ...serializableSample, cutoutUrl };
            partialSamples.push(committedSample);
            const partialAnalysis = {
              kind: "video-timeline",
              duration: sampleDuration,
              sourceSize,
              samples: [...partialSamples],
              subject: partialSamples.find((item) => item.subject)?.subject ?? null,
              detections: committedSample.detections ?? [],
              complete: false,
              coverage: {
                start: Number(partialSamples[0]?.time) || 0,
                end: Number(committedSample.time) || 0,
                duration: sampleDuration,
                sampleCount: partialSamples.length,
                maxGap: partialSamples.reduce((maximum, item, sampleIndex) => sampleIndex > 0
                  ? Math.max(maximum, item.time - partialSamples[sampleIndex - 1].time)
                  : maximum, 0),
              },
            };
            deps.setVisionRecords((records) => ({
              ...records,
              [key]: {
                analysis: partialAnalysis,
                options: records[key]?.options ?? { ...DEFAULT_VISION_OPTIONS, removeBackground: false },
              },
            }));
            deps.setVisionJob({
              running: true,
              key,
              progress: ((index + 1) / Math.max(1, total)) * 100,
              phase: formatMessage(tr("effectProcessedFrame", "Processed {current}/{total} frames · {state}"), {
                current: index + 1,
                total,
                state: committedSample.subject
                  ? tr("effectSubjectStable", "Person tracked")
                  : tr("effectSubjectLost", "Person not detected"),
              }),
            });
            const timelineTime = (deps.previewVisualRange?.start ?? 0)
              + Math.min(Number(deps.previewVisualSegment?.duration) || sampleDuration, Number(committedSample.time) || 0);
            deps.setCurrentTime?.(timelineTime);
            deps.setPreviewVideoMediaTime?.(Number(committedSample.time) || 0);
          },
        });
        const samples = result.samples.map(({ cutoutBlob, ...sample }, index) => {
          if (partialSamples[index]?.cutoutUrl) return partialSamples[index];
          const cutoutUrl = cutoutBlob ? URL.createObjectURL(cutoutBlob) : "";
          if (cutoutUrl) objectUrls.push(cutoutUrl);
          return { ...sample, cutoutUrl };
        });
        analysis = { ...result, samples, analyzedAt: Date.now(), visualType: type };
      } else {
        const blob = await captureVisualFrame({ src: source, type, maxDimension: 1024, outputType: "image/png", quality: 0.92, signal: controller.signal });
        const result = await analyzeVisualSubject({
          blob, includeMatting: true, threshold: 0.32,
          preferredLabels: ["person", "cat", "dog", "car", "bottle", "chair"],
          signal: controller.signal, onProgress,
        });
        const cutoutUrl = result.cutoutBlob ? URL.createObjectURL(result.cutoutBlob) : "";
        if (cutoutUrl) objectUrls = [cutoutUrl];
        analysis = { ...result, cutoutUrl, analyzedAt: Date.now(), visualType: type };
      }
      if (controller.signal.aborted || generation !== deps.visionJobGenerationRef.current) return;
      revokeVisionObjectUrls(deps.visionObjectUrlsRef.current.get(key));
      deps.visionObjectUrlsRef.current.set(key, objectUrls);
      deps.setVisionRecords((records) => ({
        ...records,
        [key]: { analysis, options: records[key]?.options ?? { ...DEFAULT_VISION_OPTIONS, removeBackground: false } },
      }));
      deps.setVisionJob({ running: false, key, progress: 100, phase: tr("effectAnalysisSucceeded", "Person analysis complete") });
      deps.notify(type === "image"
        ? tr("effectImageAnalysisReady", "Person detection and background removal are ready")
        : analysis.pipeline === "portrait-hybrid-roi-flow"
          ? formatMessage(tr("effectOutlineAnalysisReady", "Person outline ready: ROI matting and optical flow covered {count} frames"), { count: analysis.samples.length })
          : formatMessage(tr("effectVideoAnalysisReady", "Video analysis complete: processed {count} temporal frames"), { count: analysis.samples.length }));
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      deps.setVisionJob({ running: false, key, progress: 0, phase: tr("effectAnalysisFailed", "Person analysis failed") });
      deps.notify(tr("effectAnalysisFailedRetry", "Could not analyze the person. Try again"));
    } finally {
      if (deps.visionAbortControllerRef.current === controller) {
        deps.visionAbortControllerRef.current = null;
        deps.setVisionJob((job) => job.running && job.key === key ? { ...job, running: false } : job);
      }
    }
  }, [deps]);
}
