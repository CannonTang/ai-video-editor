export function getVisualPropertyTabIds({
  isVector = false,
  isVideo = false,
  isOverlay = false,
  hasVectorEditor = false,
} = {}) {
  if (isVector) {
    return [
      "transform",
      ...(hasVectorEditor ? ["vector"] : []),
      "animation",
      ...(isOverlay ? ["timing"] : []),
    ];
  }
  return [
    "transform",
    "mask",
    "filters",
    "animation",
    ...(isVideo ? ["speed"] : []),
    ...(isOverlay ? ["timing"] : ["repair"]),
  ];
}
