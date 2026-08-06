import {
  loadFromMirroredRepository,
  mirroredModelBaseUrls,
  mirroredModelFileUrls,
} from "../lib/modelSources.js";

export const VOICE_MODEL_REPOSITORY = "timeline-studio-voice-models";
export const VOICE_MODEL_HUGGING_FACE_REVISION = "d9e0542e0e4e8fcfb849240f7e8e7fa8147df1a3";
export const VOICE_MODEL_MODELSCOPE_REVISION = "226b24270b69b38781a35566c7d442061f9e3b81";

const mirrorOptions = (path, preference) => ({
  repository: VOICE_MODEL_REPOSITORY,
  huggingFaceRevision: VOICE_MODEL_HUGGING_FACE_REVISION,
  modelScopeRevision: VOICE_MODEL_MODELSCOPE_REVISION,
  path,
  preference,
});

export function voiceModelFileUrls(path, preference) {
  return mirroredModelFileUrls(mirrorOptions(path, preference));
}

export function voiceModelBaseUrls(path, preference) {
  return mirroredModelBaseUrls(mirrorOptions(path, preference));
}

export function loadVoiceModelFromMirrors(transformersEnv, modelPath, loader, preference) {
  return loadFromMirroredRepository(transformersEnv, {
    ...mirrorOptions("", preference),
    modelPath,
  }, loader);
}
