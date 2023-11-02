import { sendFormData } from './common';

export const create = async (projectId, fileData, stepFrontId) => {
  const blob = await (await fetch(fileData.url)).blob();
  const file = new File([blob], fileData.name, { type: fileData.type, lastModified: new Date() });

  return sendFormData(`/projects/${projectId}/artifacts/`, {
    frontId: stepFrontId,
    file,
  });
};
