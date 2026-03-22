ALTER TABLE public.store_settings
ADD COLUMN store_description text NOT NULL DEFAULT 'Zero-Fee Sports Card Storefront. Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.',
ADD COLUMN social_instagram text NOT NULL DEFAULT '',
ADD COLUMN social_twitter text NOT NULL DEFAULT '',
ADD COLUMN social_facebook text NOT NULL DEFAULT '';
