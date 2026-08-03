import {
  loadFromMirroredRepository,
  mirroredModelBaseUrls,
  mirroredModelFileUrls,
} from "../lib/modelSources.js";

export const VOICE_MODEL_REPOSITORY = "timeline-studio-voice-models";
export const VOICE_MODEL_HUGGING_FACE_REVISION = "f6aa4cf8fb440352b9f36c637dd310d047011e52";
export const VOICE_MODEL_MODELSCOPE_REVISION = "14a0656f5a111a0052dfca586fbe2ceb18b54adf";

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
