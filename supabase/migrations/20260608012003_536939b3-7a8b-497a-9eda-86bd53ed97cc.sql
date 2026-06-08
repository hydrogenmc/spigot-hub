
REVOKE EXECUTE ON FUNCTION public.claim_daily_credits(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_download(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_download(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, int, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_receipt(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_receipt(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_vip_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_ledger_to_balance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_resource_access_tier() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_vip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.downloads_today(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_download(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_payment_paid() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_daily_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_download(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_download(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_vip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.downloads_today(uuid) TO authenticated;
