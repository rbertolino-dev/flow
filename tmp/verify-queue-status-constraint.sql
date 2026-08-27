SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname = 'valid_queue_status_2';

SELECT tgname FROM pg_trigger
WHERE tgname = 'trg_broadcast_queue_2_block_rotate_phone_dup';

SELECT proname FROM pg_proc
WHERE proname = 'broadcast_queue_2_block_rotate_phone_dup';
