-- Prepared after comparing application predicates with the indexes in development.
-- Run after collecting the timing baseline, then repeat the same requests.

-- Bookmark existence-by-user is already covered by its PK
-- (user_id, target_type, target_id). This index supports reverse target lookups.
CREATE INDEX IF NOT EXISTS bookmarks_target_idx
  ON public.bookmarks (target_type, target_id);

-- Feed keyset pagination filters and sorts on the same pair.
CREATE INDEX IF NOT EXISTS posts_public_feed_cursor_idx
  ON public.posts (published_at DESC, id DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

DROP INDEX IF EXISTS public.posts_public_feed_idx;

CREATE INDEX IF NOT EXISTS public_decks_status_published_cursor_idx
  ON public.public_decks (status, published_at DESC, id DESC);

DROP INDEX IF EXISTS public.public_decks_status_published_idx;

-- Notifications also use a stable (created_at, id) keyset cursor.
CREATE INDEX IF NOT EXISTS notifications_user_created_cursor_idx
  ON public.notifications (user_id, created_at DESC, id DESC);

DROP INDEX IF EXISTS public.notifications_user_created_idx;

-- Intentionally not recreated because equivalent indexes already exist:
-- likes PK (user_id, target_type, target_id)
-- likes_target_idx (target_type, target_id, created_at DESC)
-- comments_target_created_idx (target_type, target_id, created_at)
-- notifications_user_read_created_idx (user_id, read_at, created_at DESC)
