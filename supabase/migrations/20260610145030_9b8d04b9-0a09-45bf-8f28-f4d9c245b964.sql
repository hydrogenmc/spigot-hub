
DROP TRIGGER IF EXISTS apply_ledger_balance ON public.credits_ledger;

-- Recompute balances from ledger to fix the doubled values
UPDATE public.profiles p
SET credits_balance = COALESCE((SELECT SUM(delta) FROM public.credits_ledger l WHERE l.user_id = p.id), 0);
