import {ApiError} from './http';

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.*)$/s;
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;

export type ParsedMedia = {
  mimeType: string;
  data: string;
  estimatedBytes: number;
};

export function stripDataUrl(value: string, fallbackMimeType: string): ParsedMedia {
  const match = value.match(DATA_URL_PATTERN);
  const mimeType = match ? match[1].toLowerCase() : fallbackMimeType.toLowerCase();
  const data = (match ? match[2] : value).replace(/\s/g, '');
  return {
    mimeType,
    data,
    estimatedBytes: Math.ceil((data.length * 3) / 4),
  };
}

export function assertMediaPayload(
  value: string,
  options: {
    label: string;
    fallbackMimeType: string;
    allowedMimeTypes: string[];
    maxBytes: number;
  },
) {
  const media = stripDataUrl(value, options.fallbackMimeType);

  if (!media.data) {
    throw new ApiError(400, `${options.label} is required`);
  }

  if (!BASE64_PATTERN.test(media.data)) {
    throw new ApiError(400, `${options.label} must be base64 encoded`);
  }

  if (!options.allowedMimeTypes.includes(media.mimeType)) {
    throw new ApiError(415, `Unsupported ${options.label} mime type`, {
      mimeType: media.mimeType,
      allowedMimeTypes: options.allowedMimeTypes,
    });
  }

  if (media.estimatedBytes > options.maxBytes) {
    throw new ApiError(413, `${options.label} is too large`, {
      estimatedBytes: media.estimatedBytes,
      maxBytes: options.maxBytes,
    });
  }

  return media;
}

export const imagePayloadOptions = {
  label: 'imageBase64',
  fallbackMimeType: 'image/png',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 8 * 1024 * 1024,
};

export const audioPayloadOptions = {
  label: 'audioBase64',
  fallbackMimeType: 'audio/webm',
  allowedMimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  maxBytes: 12 * 1024 * 1024,
};
