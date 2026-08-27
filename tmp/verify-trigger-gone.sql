SELECT COUNT(*)::int AS trigger_count FROM pg_trigger WHERE tgname = 'trg_broadcast_queue_2_block_rotate_phone_dup';
SELECT COUNT(*)::int AS fn_count FROM pg_proc WHERE proname = 'broadcast_queue_2_block_rotate_phone_dup';
