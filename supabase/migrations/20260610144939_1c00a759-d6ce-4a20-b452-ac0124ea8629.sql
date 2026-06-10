
-- Apply ledger delta to profiles.credits_balance
DROP TRIGGER IF EXISTS apply_ledger_balance ON public.credits_ledger;
CREATE TRIGGER apply_ledger_balance
AFTER INSERT ON public.credits_ledger
FOR EACH ROW EXECUTE FUNCTION public.apply_ledger_to_balance();

-- Activate VIP on payment paid
DROP TRIGGER IF EXISTS handle_payment_paid_trg ON public.payments;
CREATE TRIGGER handle_payment_paid_trg
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_paid();

-- Validate resource access tier
DROP TRIGGER IF EXISTS validate_resource_access_tier_trg ON public.resources;
CREATE TRIGGER validate_resource_access_tier_trg
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.validate_resource_access_tier();

-- Backfill signup bonus for existing users who have no ledger entries
INSERT INTO public.credits_ledger (user_id, delta, reason)
SELECT p.id, 20, 'signup_bonus'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.credits_ledger l
  WHERE l.user_id = p.id AND l.reason = 'signup_bonus'
);
