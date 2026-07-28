import { useEffect, useMemo, useRef, useState } from "react";

import { ensureCaptionFontLoaded } from "../lib/captionFonts.js";
import { drawCaptionLayout, getCaptionTextLayout } from "../lib/captionLayout.js";

const FALLBACK_PREVIEW_FRAME = { width: 640, height: 360 };

export function CaptionOverlay({
  text,
  captionSize,
  captionStyle,
  placement,
  frameSize,
  onPointerDown,
  onDoubleClick,
}) {
  const canvasRef = useRef(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [fontStatus, setFontStatus] = useState("ready");
  const renderFrame =
    frameSize?.width > 0 && frameSize?.height > 0 ? frameSize : FALLBACK_PREVIEW_FRAME;
  useEffect(() => {
    let canceled = false;
    const fontId = captionStyle?.fontId || "default";
    if (fontId === "default") {
      setFontStatus("ready");
      return undefined;
    }
    setFontStatus("loading");
    ensureCaptionFontLoaded(captionStyle?.fontId, text)
      .then(() => {
        if (!canceled) {
          setFontStatus("ready");
          setFontRevision((value) => value + 1);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFontStatus("failed");
          setFontRevision((value) => value + 1);
        }
      });
    return () => {
      canceled = true;
    };
  }, [captionStyle?.fontId, text]);
  const layout = useMemo(
    () =>
      getCaptionTextLayout({
        text,
        captionSize,
        captionStyle,
        referenceFrame: renderFrame,
        renderFrame,
      }),
    [captionSize, captionStyle, fontRevision, renderFrame.height, renderFrame.width, text],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout.width || !layout.height) {
      return;
    }

    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.ceil(layout.width * pixelRatio));
    canvas.height = Math.max(1, Math.ceil(layout.height * pixelRatio));
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawCaptionLayout(context, layout);
  }, [layout]);

  return (
    <button
      className={`caption-overlay ${fontStatus === "loading" ? "is-font-loading" : ""}`}
      type="button"
      aria-label={text}
      aria-busy={fontStatus === "loading"}
      style={{
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        borderRadius: `${layout.metrics.radius}px`,
        left: `${placement.x}%`,
        top: `${placement.y}%`,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {fontStatus === "loading" ? <span className="caption-font-loading-indicator" aria-hidden="true" /> : null}
    </button>
  );
}
