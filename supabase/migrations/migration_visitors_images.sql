
-- Add array column for multiple visitor card images
ALTER TABLE visitors 
ADD COLUMN IF NOT EXISTS visitor_card_images TEXT[] DEFAULT '{}';

-- Migrate existing single image URLs to the new array structure
-- Only migrate if the array is empty and there is an existing image
UPDATE visitors 
SET visitor_card_images = ARRAY[visitor_card_image_url]
WHERE visitor_card_image_url IS NOT NULL 
  AND visitor_card_image_url != '' 
  AND (visitor_card_images IS NULL OR array_length(visitor_card_images, 1) IS NULL);
