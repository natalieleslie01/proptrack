-- Reset asking_rent to NULL for all properties where asking_rent = 100 (displayed as HK$100/mo)
UPDATE public.properties
SET asking_rent = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE asking_rent = 100;
