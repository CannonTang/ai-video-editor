import { MAX_TIMELINE_DURATION_SECONDS } from "../config/editor.js";
import { decodeWaveform } from "./media.js";
import {
  createCaptionSegments,
  estimateDuration,
  formatSavedTime,
  getCaptionTimeline,
} from "./timeline.js";
import { getGeneratedVoiceAppendStart } from "./generatedVoicePlacement.js";

export function createAudioTrackActions(d) {
  function replaceAudio(blob, duration, nextPeaks, nextStatusText, options = {}) {
    const nextUrl = URL.createObjectURL(blob);
    const decodedDuration = Number(duration);
    const estimatedFallback = Number(estimateDuration(options.script ?? d.script));
    const nextDuration = Number.isFinite(decodedDuration) && decodedDuration > 0
      ? decodedDuration
      : Number.isFinite(estimatedFallback) && estimatedFallback > 0 ? estimatedFallback : 0;
    const start = Math.max(0, options.start ?? d.currentTimeRef.current ?? 0);
    const id = crypto.randomUUID();
    const segment = {
      id,
      blob,
      url: nextUrl,
      start,
      duration: nextDuration,
      sourceDuration: nextDuration,
      playbackRate: 1,
      peaks: Array.isArray(nextPeaks) ? nextPeaks : [],
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      reversed: false,
      name: options.name || d.selectedVoice?.name || d.t("voiceTrack"),
      sourceKind: options.sourceKind || (options.voiceId ? "ai-voice" : "upload"),
      voiceId: options.voiceId || "",
      voiceName: options.voiceName || "",
      cloneVoiceProfileId: options.cloneVoiceProfileId || "",
      cloneVoiceProfileName: options.cloneVoiceProfileName || "",
      assetId: options.assetId || "",
    };
    if (options.replaceSegmentId) {
      const replaced = d.audioSegments.find((item) => item.id === options.replaceSegmentId);
      d.audioSegmentRefs.current.get?.(options.replaceSegmentId)?.pause?.();
      if (replaced?.url) URL.revokeObjectURL(replaced.url);
    }
    d.setAudioSegments((segments) => [
      ...segments.filter((item) => item.id !== options.replaceSegmentId),
      segment,
    ]);
    d.setSelectedAudioSegmentId(id);
    d.setSelectedTrack("audio");
    d.setCurrentTime(start);
    d.setStatus("done");
    d.setStatusText(nextStatusText);
    d.setProgress(100);
    return segment;
  }

  function clearAudioTrack(message = "配音音频已从时间线移除") {
    const removedAudioIds = new Set(d.audioSegments.map((segment) => segment.id));
    d.audioSegmentRefs.current.forEach((audio) => audio.pause());
    d.audioSegments.forEach((segment) => URL.revokeObjectURL(segment.url));
    d.setAudioSegments([]);
    if (d.generatedVoiceEndRef) d.generatedVoiceEndRef.current = 0;
    d.setCaptionSegments((segments) => segments.map((caption) => (
      removedAudioIds.has(caption.audioSegmentId) || removedAudioIds.has(caption.detachedAudioSegmentId)
        ? { ...caption, audioSegmentId: "", detachedAudioSegmentId: "" }
        : caption
    )));
    d.setSelectedAudioSegmentId("");
    d.setCurrentTime(0);
    d.setIsPlaying(false);
    d.setStatus("ready");
    d.setStatusText("音频轨已清空");
    d.notify(message);
  }

  function replaceMusic(blob, duration, nextPeaks, nextName, message = "背景音乐已添加到时间线", options = {}) {
    // Replacing the source while the timeline is playing can leave React's
    // playback state active after the old object URL has been revoked. The new
    // audio element then mounts after the sync effect and never receives play().
    // Stop the old element first so the next user play starts from a clean state.
    d.musicRef.current?.pause();
    d.setIsPlaying(false);
    if (d.musicUrlRef.current) URL.revokeObjectURL(d.musicUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    const nextDuration = Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : 0;
    d.musicUrlRef.current = nextUrl;
    d.setMusicBlob(blob);
    d.setMusicUrl(nextUrl);
    d.setMusicName(nextName);
    d.setMusicDuration(nextDuration);
    const nextStart = Math.max(0, Number(options.start) || 0);
    d.setMusicStart(nextStart);
    d.setMusicPeaks(nextPeaks);
    d.setMusicSegments?.([{ id: crypto.randomUUID(), start: nextStart, duration: nextDuration, sourceStart: 0, sourceDuration: nextDuration, playbackRate: 1, peaks: nextPeaks }]);
    d.setSelectedTrack("music");
    if (options.focusAudio !== false) d.setActiveTool("audio");
    d.notify(message);
  }

  function replaceSourceAudio(
    blob,
    duration,
    nextPeaks,
    nextName,
    message = "视频原声已分离到时间线",
    timelineStart = 0,
    assetId = d.sourceAudioAssetId,
    options = {},
  ) {
    if (d.sourceAudioUrlRef.current) URL.revokeObjectURL(d.sourceAudioUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    d.sourceAudioUrlRef.current = nextUrl;
    const nextStart = Math.max(0, Math.min(MAX_TIMELINE_DURATION_SECONDS, timelineStart || 0));
    d.setSourceAudioBlob(blob);
    d.setSourceAudioUrl(nextUrl);
    d.setSourceAudioName(nextName);
    d.setSourceAudioDuration(duration || 0);
    d.setSourceAudioPeaks(nextPeaks);
    d.setSourceAudioVolume(1);
    d.setSourceAudioStart(nextStart);
    d.setSourceAudioAssetId(assetId || "");
    d.setSourceAudioLinked(true);
    if (options.focusAudio !== false) {
      d.setSelectedTrack("source");
      d.setActiveTool("audio");
    }
    d.setStatus("done");
    d.setStatusText("视频原声已分离");
    d.setProgress(100);
    d.notify(message);
  }

  function clearSourceAudioTrack(message = "视频原声已从时间线移除") {
    d.sourceAudioRef.current?.pause();
    if (d.sourceAudioUrlRef.current) {
      URL.revokeObjectURL(d.sourceAudioUrlRef.current);
      d.sourceAudioUrlRef.current = "";
    }
    d.setSourceAudioBlob(null);
    d.setSourceAudioUrl("");
    d.setSourceAudioName("");
    d.setSourceAudioDuration(0);
    d.setSourceAudioPeaks([]);
    d.setSourceAudioStart(0);
    d.setSourceAudioAssetId("");
    d.setSourceAudioLinked(true);
    d.setCurrentTime((time) => Math.min(time, Math.max(
      d.audioBlob ? d.audioDuration : 0,
      d.captionDuration,
      d.musicBlob ? d.musicDuration : 0,
      d.imageSrc ? d.imageDuration : 0,
      estimateDuration(d.script),
    )));
    d.setIsPlaying(false);
    d.setSelectedTrack("source");
    if (message) d.notify(message);
  }

  function clearMusicTrack(message = "背景音乐已从时间线移除") {
    d.musicRef.current?.pause();
    if (d.musicUrlRef.current) {
      URL.revokeObjectURL(d.musicUrlRef.current);
      d.musicUrlRef.current = "";
    }
    d.setMusicBlob(null);
    d.setMusicUrl("");
    d.setMusicName("");
    d.setMusicDuration(0);
    d.setMusicStart(0);
    d.setMusicPeaks([]);
    d.setMusicSegments?.([]);
    d.setCurrentTime((time) => Math.min(time, Math.max(
      d.audioBlob ? d.audioDuration : 0,
      d.captionDuration,
      d.sourceAudioBlob ? d.sourceAudioStart + d.sourceAudioDuration : 0,
      d.imageSrc ? d.imageDuration : 0,
      estimateDuration(d.script),
    )));
    d.setIsPlaying(false);
    d.setSelectedTrack("music");
    d.notify(message);
  }

  async function commitAudio(blob, nextStatusText, options = {}) {
    const decoded = await decodeWaveform(blob);
    const captionSegment = options.captionSegment;
    const identity = {
      sourceKind: options.sourceKind || "ai-voice",
      voiceId: d.selectedVoiceId,
      voiceName: options.cloneVoiceProfileName
        ? `${options.cloneVoiceProfileName} · ${d.selectedVoice.name}`
        : d.selectedVoice.name,
      name: options.cloneVoiceProfileName || d.selectedVoice.name,
      cloneVoiceProfileId: options.cloneVoiceProfileId || "",
      cloneVoiceProfileName: options.cloneVoiceProfileName || "",
    };
    const rememberedVoiceEnd = Number(d.generatedVoiceEndRef?.current) || 0;
    const appendStart = Math.max(
      rememberedVoiceEnd ? rememberedVoiceEnd + 0.6 : 0,
      getGeneratedVoiceAppendStart(d.audioSegmentsRef?.current ?? d.audioSegments, d.currentTimeRef.current),
    );
    const audioSegment = replaceAudio(blob, decoded.duration, decoded.peaks, nextStatusText, captionSegment ? {
      start: captionSegment.start || 0,
      script: options.script || captionSegment.text,
      replaceSegmentId: captionSegment.audioSegmentId || captionSegment.detachedAudioSegmentId || "",
      ...identity,
    } : {
      ...options,
      start: options.start ?? appendStart,
      ...identity,
    });
    if (!captionSegment && d.generatedVoiceEndRef) {
      d.generatedVoiceEndRef.current = audioSegment.start + audioSegment.duration;
    }

    if (captionSegment) {
      d.setCaptionSegments((segments) => segments.map((segment) => segment.id === captionSegment.id ? {
        ...segment,
        audioSegmentId: "",
        detachedAudioSegmentId: audioSegment.id,
        start: audioSegment.start,
        end: audioSegment.start + audioSegment.duration,
      } : segment).sort((a, b) => (a.start || 0) - (b.start || 0)));
      d.setSelectedSegmentId(captionSegment.id);
      d.setHistoryItems((items) => [{
        id: crypto.randomUUID(),
        blob,
        voiceId: d.selectedVoiceId,
        voiceName: d.selectedVoice.name,
        script: options.script || captionSegment.text,
        duration: decoded.duration || estimateDuration(options.script || captionSegment.text),
        peaks: decoded.peaks,
        createdAt: formatSavedTime(),
      }, ...items.slice(0, 8)]);
      return;
    }

    const generatedCaptions = createCaptionSegments(d.script);
    const generatedTimeline = getCaptionTimeline(generatedCaptions, audioSegment.duration);
    const alignedCaptions = generatedCaptions.map((segment, index) => ({
      ...segment,
      audioSegmentId: "",
      detachedAudioSegmentId: audioSegment.id,
      start: audioSegment.start + generatedTimeline[index].start,
      end: audioSegment.start + generatedTimeline[index].end,
    }));
    d.setCaptionSegments((segments) => [
      ...segments,
      ...alignedCaptions,
    ].sort((a, b) => (a.start || 0) - (b.start || 0)));
    d.setSelectedSegmentId(alignedCaptions[0]?.id ?? "");
    d.setHistoryItems((items) => [{
      id: crypto.randomUUID(),
      blob,
      voiceId: d.selectedVoiceId,
      voiceName: d.selectedVoice.name,
      script: d.script,
      duration: decoded.duration || estimateDuration(d.script),
      peaks: decoded.peaks,
      createdAt: formatSavedTime(),
    }, ...items.slice(0, 8)]);
  }

  return {
    clearAudioTrack,
    clearMusicTrack,
    clearSourceAudioTrack,
    commitAudio,
    replaceAudio,
    replaceMusic,
    replaceSourceAudio,
  };
}
