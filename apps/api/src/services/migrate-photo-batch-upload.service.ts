import { buildImportBundleObjectKey } from "@fsm/config/import-bundle-storage";
import { emitEvent } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  buildMigratePhotoVendorFileId,
  type MigratePhotoMigrationState,
  type MigratePhotoUploadStatusResponse
} from "@fsm/types";

import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_FILE_SIZE_BYTES } from "./attachment.service.js";
import { uploadFile } from "../lib/storage.js";
import {
  ensurePhotoMigrationMediaSession,
  getScopedImportBundle,
  persistBundleStepState,
  readPhotoMigrationState
} from "./migrate-photo-migration-state.js";

export interface PhotoBatchUploadFile {
  relativePath: string;
  mimeType: string;
  buffer: Buffer;
}

const MAX_FILES_PER_REQUEST = 50;

function sanitizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (normalized.length === 0 || normalized.includes("..")) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid relative path for photo upload");
  }
  return normalized;
}

export async function uploadMigratePhotoBatch(
  companyId: string,
  actorId: string,
  bundleId: string,
  clientBatchId: string,
  files: PhotoBatchUploadFile[]
): Promise<MigratePhotoUploadStatusResponse> {
  if (clientBatchId.trim().length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "clientBatchId is required");
  }

  if (files.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "At least one file is required");
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Upload at most ${String(MAX_FILES_PER_REQUEST)} files per batch`);
  }

  let bundle = await getScopedImportBundle(companyId, bundleId);
  let photoMigration = await ensurePhotoMigrationMediaSession(companyId, actorId, bundle);

  const existingVendorIds = new Set(photoMigration.objects.map((object) => object.vendorFileId));
  const uploadedNow: MigratePhotoMigrationState["objects"] = [];

  for (const file of files) {
    const relativePath = sanitizeRelativePath(file.relativePath);
    const vendorFileId = buildMigratePhotoVendorFileId(relativePath);

    if (existingVendorIds.has(vendorFileId)) {
      continue;
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimeType)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unsupported file type for ${relativePath}`);
    }

    if (file.buffer.byteLength > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `File ${relativePath} exceeds size limit`);
    }

    const r2Key = buildImportBundleObjectKey(companyId, bundleId, relativePath);
    const uploaded = await uploadFile(r2Key, file.buffer, file.mimeType);

    uploadedNow.push({
      vendorFileId,
      relativePath,
      r2Key: uploaded.key,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString()
    });
    existingVendorIds.add(vendorFileId);
  }

  const receivedAt = new Date().toISOString();
  const nextObjects = [...photoMigration.objects, ...uploadedNow];
  const nextState: MigratePhotoMigrationState = {
    ...photoMigration,
    objects: nextObjects,
    clientBatches: {
      ...photoMigration.clientBatches,
      [clientBatchId]: {
        receivedAt,
        objectCount: uploadedNow.length
      }
    }
  };

  bundle = await persistBundleStepState(companyId, bundleId, { photoMigration: nextState });
  photoMigration = readPhotoMigrationState(bundle) ?? nextState;

  if (uploadedNow.length > 0) {
    await emitEvent({
      companyId,
      actorId,
      actorType: "user",
      eventType: "import.bundle.step_advanced",
      entityType: "import_bundle",
      entityId: bundleId,
      payload: {
        photoBatchUploaded: uploadedNow.length,
        clientBatchId
      },
      summary: `Photo migration batch uploaded (${String(uploadedNow.length)} file(s))`
    });
  }

  return {
    bundleId,
    mediaImportSessionId: photoMigration.mediaImportSessionId,
    objectCount: photoMigration.objects.length,
    clientBatchCount: Object.keys(photoMigration.clientBatches).length,
    resumable: true
  };
}

export async function getMigratePhotoUploadStatus(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<MigratePhotoUploadStatusResponse> {
  const bundle = await getScopedImportBundle(companyId, bundleId);
  const photoMigration = await ensurePhotoMigrationMediaSession(companyId, actorId, bundle);

  return {
    bundleId,
    mediaImportSessionId: photoMigration.mediaImportSessionId,
    objectCount: photoMigration.objects.length,
    clientBatchCount: Object.keys(photoMigration.clientBatches).length,
    resumable: true
  };
}
