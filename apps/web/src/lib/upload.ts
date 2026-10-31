import { API_BASE_URL } from "./api-base-url";
import type { FileAttachment } from "@fsm/types";

import { ApiError, handleUnauthorized, resolveBearerToken, type ApiErrorPayload } from "./api";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const API_BASE = API_BASE_URL;

interface AttachmentResponse {
  attachment: FileAttachment;
}

export interface UploadFileInput {
  file: File;
  entityType: string;
  entityId: string;
  photoType?: "before" | "after" | "general";
  caption?: string;
  takenAt?: string;
  onProgress?: (progress: number) => void;
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function parseErrorPayload(text: string): ApiErrorPayload {
  try {
    return JSON.parse(text) as ApiErrorPayload;
  } catch {
    return {
      error: "NOT_IMPLEMENTED",
      message: text || "Upload failed"
    };
  }
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new UploadValidationError("Files must be 50MB or smaller.");
  }
}

export function getMaxUploadFileSizeBytes() {
  return MAX_FILE_SIZE_BYTES;
}

export async function uploadFile(input: UploadFileInput): Promise<FileAttachment> {
  validateFile(input.file);

  // XHR (not fetch) for upload progress, so authorizedFetch can't be used; same token + 401 rules.
  const { token, source } = await resolveBearerToken();

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const request = new XMLHttpRequest();

    formData.append("file", input.file);
    formData.append("entityType", input.entityType);
    formData.append("entityId", input.entityId);

    if (input.photoType) {
      formData.append("photoType", input.photoType);
    }

    if (input.caption) {
      formData.append("caption", input.caption);
    }

    if (input.takenAt) {
      formData.append("takenAt", input.takenAt);
    }

    request.open("POST", `${API_BASE}/api/v1/attachments`);
    request.withCredentials = true;

    if (token) {
      request.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onerror = () => reject(new Error("Upload failed"));

    request.onload = () => {
      if (request.status === 401) {
        void handleUnauthorized(source);
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new ApiError(request.status, parseErrorPayload(request.responseText)));
        return;
      }

      try {
        const response = JSON.parse(request.responseText) as AttachmentResponse;
        resolve(response.attachment);
      } catch {
        reject(new Error("Attachment upload response was invalid"));
      }
    };

    request.send(formData);
  });
}
