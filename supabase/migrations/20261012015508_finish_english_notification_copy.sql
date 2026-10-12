update public.notifications
set body = case
  when type = 'deck_visibility_changed' and body like '% sekarang publik.'
    then regexp_replace(body, ' sekarang publik\.$', ' is now public.')
  when type = 'deck_visibility_changed' and body like '% kembali private.'
    then regexp_replace(body, ' kembali private\.$', ' is private again.')
  when type = 'deck_visibility_changed' and body like '% sekarang bisa diakses lewat link.'
    then regexp_replace(body, ' sekarang bisa diakses lewat link\.$', ' is now accessible by link.')
  else body
end
where type = 'deck_visibility_changed';
