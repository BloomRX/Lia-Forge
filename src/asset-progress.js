const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;

function canonicalOutputPath(value) {
  const parts = [];
  for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/').toLocaleLowerCase('en-US');
}

export function countDistinctReferenceImages(outputs) {
  if (!Array.isArray(outputs)) return 0;
  const imagePaths = outputs
    .filter((output) => typeof output === 'string' && IMAGE_EXTENSION.test(output))
    .map(canonicalOutputPath)
    .filter(Boolean);
  return new Set(imagePaths).size;
}

export function isLegacyIncompleteReferenceCompletion(asset) {
  const referenceStage = asset?.stageStatus?.[1];
  return referenceStage?.status === 'completed' && countDistinctReferenceImages(referenceStage.outputs) < 3;
}

export function assetCompletionFlags(asset) {
  const completed = Array.isArray(asset?.completed) ? asset.completed.map(Boolean) : [];
  if (completed[1] && isLegacyIncompleteReferenceCompletion(asset)) completed[1] = false;
  return completed;
}
