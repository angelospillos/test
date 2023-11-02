import * as SparkMD5 from 'spark-md5';

export interface UploadContext {
  url: string;
  key: string;
  policy: string;
  'x-amz-signature': string;
  'x-amz-date': string;
  'x-amz-credential': string;
  'x-amz-algorithm': string;
}

type ImageBase64 = string;

export const updateRunScreenshot = async ({
  uploadContext,
  file,
  screenshotType,
}: {
  uploadContext: UploadContext;
  file: ImageBase64;
  screenshotType: 'stepRunWindow' | 'stepRunCoverageElement' | 'step';
}): Promise<string> => {
  const fileHash = SparkMD5.hash(file);
  const contentType = 'image/webp';
  const filename = `${fileHash}-${screenshotType}.webp`;

  const imageFile = new File([await (await fetch(file)).blob()], filename, {
    type: contentType,
  });

  const formData = new FormData();
  formData.append('acl', 'private');
  ['key', 'x-amz-algorithm', 'x-amz-credential', 'x-amz-date', 'x-amz-signature', 'policy'].forEach(
    (field) => {
      formData.append(field, uploadContext[field]);
    },
  );
  formData.append('Content-Type', contentType);
  formData.append('file', imageFile, filename);

  await fetch(uploadContext.url, {
    method: 'POST',
    body: formData,
  });

  // eslint-disable-next-line no-template-curly-in-string
  const key = uploadContext.key.replace('${filename}', filename);
  return `${uploadContext.url}${key}`;
};
