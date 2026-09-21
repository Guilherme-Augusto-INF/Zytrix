# 09 — Storage migration

## Current evidence

The repository contains a Firebase Storage bucket name and allows Firebase/Google Storage URLs in image validation, but it imports no Firebase Storage SDK and contains no upload/download implementation. Read-only production Console inspection confirmed Firebase Storage is **not activated** on the Spark project and requires a Blaze upgrade before setup. Therefore there is no Firebase Storage source object set to migrate at this baseline.

## Target buckets

- `avatars`: public read, owner UUID path, 2 MiB, JPEG/PNG/WebP.
- `channel-assets`: public read, owned channel UUID path, 5 MiB, JPEG/PNG/WebP.
- `live-thumbnails`: public read, owned live UUID path, 5 MiB, JPEG/PNG/WebP.

No clips/media bucket is created until a real clip media pipeline exists.

## Path conventions

```text
avatars/<user_uuid>/<generated_filename>
channel-assets/<channel_uuid>/<generated_filename>
live-thumbnails/<live_uuid>/<generated_filename>
```

The first segment is parsed and authorized in Storage RLS. Browser input does not choose another user's owner path. Random server/client-generated filenames avoid collisions; upsert is used only when replacement is intended.

## Target verification

- object count and total bytes by prefix/bucket;
- size and content type per object;
- checksum where source metadata supports it;
- owner/reference resolution;
- signed/public URL behavior;
- negative tests for write/update/delete in another owner's path;
- Recheck Firebase Storage activation immediately before cutover; if it remains inactive, record source object count as zero/N/A.
