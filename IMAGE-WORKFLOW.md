# Durable Immich and CDN Image Workflow

## Architecture

Immich is the organizer and import source. The CDN is the published copy used by the blog. A separate Restic repository is the backup.

```text
Immich shared album
        ↓ snapshot command
CDN originals + responsive WebP + manifest
        ↓ production page load
Blog gallery

CDN image tree
        ↓ scheduled Restic job
Off-site backup repository
```

After an album is snapshotted, the public blog does not require Immich to remain online. Immich can still be retained as a convenient editing/import interface.

## Publish an album

1. Create a shared album in Immich.
2. From `app/`, run:

   ```bash
   npm run snapshot:immich -- \
     --share-url "https://photos.nickesselman.nl/s/SHARE_SLUG" \
     --story moonshot
   ```

3. The command:
   - downloads every original to a temporary directory;
   - assigns a content-hashed, immutable filename;
   - creates video poster frames;
   - copies the snapshot to `nick:/srv/services/cdn/blogimages/<story>/album`;
   - creates 480, 960, and 1600px WebP derivatives;
   - writes `manifest.json`;
   - prints the environment variable to add to the blog.

4. Add the printed value to the deployment environment, for example:

   ```dotenv
   MOONSHOT_GALLERY_MANIFEST_URL=https://cdn.nickesselman.nl/blogimages/moonshot/album/manifest.json
   ```

5. Re-run the same command whenever the Immich album changes. It is additive: old content-hashed files are retained, while the manifest controls which assets appear.

The existing Immich share URL remains an optional fallback when no published manifest is configured.

## Off-site backup

The CDN host does not currently have Restic installed. Install Restic and configure a repository on separate storage such as Backblaze B2, S3-compatible object storage, or another physical server.

Required environment:

```bash
RESTIC_REPOSITORY="..."
RESTIC_PASSWORD_FILE="/path/to/protected-password-file"
```

Run the checked-in backup script on the CDN host:

```bash
bash app/scripts/backup-cdn-images.sh /srv/services/cdn/blogimages
```

The script keeps 7 daily, 5 weekly, and 12 monthly snapshots, prunes expired data, and verifies repository integrity. Schedule it daily only after a test backup and restore succeed.

## Restore test

At least quarterly, restore to a temporary directory and compare the published tree:

```bash
restic restore latest --tag blogimages --target /tmp/blogimages-restore
```

Do not treat a second directory on the CDN server as a backup; it must live on independent storage.
